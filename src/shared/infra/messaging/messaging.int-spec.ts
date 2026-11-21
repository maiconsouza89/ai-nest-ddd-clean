import 'reflect-metadata';
import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { StartedRedisContainer } from '@testcontainers/redis';
import { DataSource } from 'typeorm';
import { FakeLogger } from '../../../../test/fakes/fake-logger';
import { startOutboxDatabase } from '../../../../test/helpers/outbox-database';
import { startRedis } from '../../../../test/helpers/redis';
import { waitFor } from '../../../../test/helpers/wait-for';
import { IdempotentConsumer } from '../../application/idempotent-consumer';
import type { IntegrationEvent } from '../../application/integration-event';
import { Logger } from '../../application/ports/logger';
import { EventPublisher } from '../../application/ports/event-publisher';
import { currentManager } from '../database/transaction-context';
import { TypeOrmTransactionManager } from '../database/typeorm-transaction-manager';
import { TypeOrmProcessedEvents } from '../outbox/typeorm-processed-events';
import { IntegrationEventHandler } from './integration-event-handler.decorator';
import { MessagingModule } from './messaging.module';

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
  let redis: StartedRedisContainer;
  let app: TestingModule;
  let publisher: EventPublisher;

  beforeAll(async () => {
    ({ ds, stop: stopDb } = await startOutboxDatabase());
    await ds.query(`CREATE TABLE IF NOT EXISTS shared.effects (event_id text, note text)`);
    idempotent = new IdempotentConsumer(new TypeOrmTransactionManager(ds), new TypeOrmProcessedEvents(ds), logger);
    redis = await startRedis();
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ REDIS_URL: redis.getConnectionUrl(), QUEUE_WORKERS_ENABLED: 'true' })],
        }),
        TestLoggerModule,
        MessagingModule,
      ],
      providers: [WritesEffectHandler, AlwaysFailsHandler],
    }).compile();
    await app.init();
    publisher = app.get(EventPublisher);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await redis?.stop();
    await stopDb?.();
  }, 60_000);

  const event = (): IntegrationEvent => ({
    eventId: crypto.randomUUID(),
    type: 'test.thing-happened',
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: {},
  });
  const effectCount = async (e: IntegrationEvent) =>
    Number((await ds.query(`SELECT count(*) FROM shared.effects WHERE event_id = $1`, [e.eventId]))[0].count);

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
    await expect(publisher.publish({ ...event(), type: 'test.nobody-listens' })).resolves.toBeUndefined();
  });
});
