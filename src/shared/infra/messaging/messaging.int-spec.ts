import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { metrics } from '@opentelemetry/api';
import { DataSource } from 'typeorm';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startTestMetrics } from '#test/helpers/metrics';
import { startOutboxDatabase } from '#test/helpers/outbox-database';
import { startRedis } from '#test/helpers/redis';
import { waitFor } from '#test/helpers/wait-for';
import { IdempotentConsumer } from '../../application/idempotent-consumer.js';
import type { IntegrationEvent } from '../../application/integration-event.js';
import { Logger } from '../../application/ports/logger.js';
import { EventPublisher } from '../../application/ports/event-publisher.js';
import { currentManager } from '../database/transaction-context.js';
import { TypeOrmTransactionManager } from '../database/typeorm-transaction-manager.js';
import { TypeOrmProcessedEvents } from '../outbox/typeorm-processed-events.js';
import { IntegrationEventHandler } from './integration-event-handler.decorator.js';
import { MessagingModule } from './messaging.module.js';

const logger = new FakeLogger();

@Global()
@Module({ providers: [{ provide: Logger, useValue: logger }], exports: [Logger] })
class TestLoggerModule {}

const failedAttempts: string[] = [];
let ds: DataSource;
let idempotent: IdempotentConsumer;

@Injectable()
class WritesEffectHandler {
  @IntegrationEventHandler({ events: ['test.thing-happened'], consumer: 'test.writes-effect' })
  handle(event: IntegrationEvent) {
    return idempotent.handle('test.writes-effect', event, async (e) => {
      await currentManager(ds).query(`INSERT INTO shared.effects VALUES ($1, 'ok')`, [e.eventId]);
    });
  }
}

@Injectable()
class AlwaysFailsHandler {
  @IntegrationEventHandler({ events: ['test.thing-happened'], consumer: 'test.always-fails' })
  handle(event: IntegrationEvent) {
    failedAttempts.push(event.eventId);
    return Promise.reject(new Error('boom'));
  }
}

describe('Mensageria com BullMQ (integração: Postgres e Redis)', () => {
  let stopDb: () => Promise<void>;
  let redisUrl: string;
  let app: TestingModule;
  let publisher: EventPublisher;
  let collectPoints: ReturnType<typeof startTestMetrics>;

  beforeAll(async () => {
    ({ ds, stop: stopDb } = await startOutboxDatabase());
    await ds.query(`CREATE TABLE IF NOT EXISTS shared.effects (event_id text, note text)`);
    idempotent = new IdempotentConsumer(
      new TypeOrmTransactionManager(ds),
      new TypeOrmProcessedEvents(ds),
      logger,
    );
    redisUrl = await startRedis();
    // antes do app.init(): as métricas pedem o meter na subida
    collectPoints = startTestMetrics();
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ REDIS_URL: redisUrl, QUEUE_WORKERS_ENABLED: 'true' })],
        }),
        TestLoggerModule,
        MessagingModule,
      ],
      providers: [WritesEffectHandler, AlwaysFailsHandler],
    }).compile();
    await app.init();
    publisher = app.get(EventPublisher);
  });

  afterAll(async () => {
    await app?.close();
    metrics.disable();
    await stopDb?.();
  });

  const event = (): IntegrationEvent => ({
    eventId: crypto.randomUUID(),
    type: 'test.thing-happened',
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: {},
  });
  const effectCount = async (e: IntegrationEvent) =>
    Number(
      (await ds.query(`SELECT count(*) FROM shared.effects WHERE event_id = $1`, [e.eventId]))[0]
        .count,
    );

  it('um consumidor que falha não impede os outros de receberem o evento', async () => {
    const e = event();

    await publisher.publish(e);

    await waitFor(async () => (await effectCount(e)) === 1);
    await waitFor(() => failedAttempts.includes(e.eventId));
  });

  it('enfileirar o mesmo evento duas vezes produz o efeito uma vez só', async () => {
    const e = event();

    await publisher.publish(e);
    await publisher.publish(e);
    await waitFor(async () => (await effectCount(e)) === 1);
    // dá tempo de um eventual segundo job (que não deveria existir) ser processado
    await new Promise((r) => setTimeout(r, 500));

    expect(await effectCount(e)).toBe(1);
  });

  it('evento sem assinante é aceito sem enfileirar nada', async () => {
    await expect(
      publisher.publish({ ...event(), type: 'test.nobody-listens' }),
    ).resolves.toBeUndefined();
  });

  it('a falha que vai ser repetida conta em bullmq.jobs.retried, na fila do consumidor', async () => {
    await publisher.publish(event());
    const retriedIn = async (queue: string) =>
      (await collectPoints('bullmq.jobs.retried'))
        .filter((p) => p.attributes['bullmq.queue.name'] === queue)
        .reduce((sum, p) => sum + p.value, 0);

    await waitFor(async () => (await retriedIn('events.test.always-fails')) > 0);
    expect(await retriedIn('events.test.writes-effect')).toBe(0);
  });

  it('bullmq.queue.jobs traz cada fila de eventos com os quatro estados', async () => {
    const points = await collectPoints('bullmq.queue.jobs');

    const seen = points.map(
      (p) =>
        `${String(p.attributes['bullmq.queue.name'])} ${String(p.attributes['bullmq.queue.jobs.state'])}`,
    );
    expect(seen.sort()).toEqual(
      ['events.test.always-fails', 'events.test.writes-effect']
        .flatMap((queue) => ['active', 'delayed', 'failed', 'waiting'].map((s) => `${queue} ${s}`))
        .sort(),
    );
  });
});
