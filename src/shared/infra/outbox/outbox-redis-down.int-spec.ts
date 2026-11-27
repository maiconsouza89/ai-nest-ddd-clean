import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import 'reflect-metadata';
import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { StartedRedisContainer } from '@testcontainers/redis';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startOutboxDatabase } from '#test/helpers/outbox-database';
import { startRedisContainer } from '#test/helpers/redis';
import { startTcpProxy, TcpProxy } from '#test/helpers/tcp-proxy';
import { waitFor } from '#test/helpers/wait-for';
import { IntegrationEvent } from '../../application/integration-event.js';
import {
  EventPublisher,
  EventTransportUnavailableError,
} from '../../application/ports/event-publisher.js';
import { Logger } from '../../application/ports/logger.js';
import { IntegrationEventHandler } from '../messaging/integration-event-handler.decorator.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { QueueRedisConnection } from '../redis/queue-redis.connection.js';
import { RedisModule } from '../redis/redis.module.js';
import { DEFAULT_OUTBOX_OPTIONS, OutboxRelay } from './outbox-relay.js';
import { TypeOrmOutbox } from './typeorm-outbox.js';

const logger = new FakeLogger();

@Global()
@Module({ providers: [{ provide: Logger, useValue: logger }], exports: [Logger] })
class TestLoggerModule {}

// os workers das filas ficam desligados: o teste olha o job na fila, e não o efeito
@Injectable()
class WarmHandler {
  @IntegrationEventHandler({ events: ['test.warm'], consumer: 'test.warm-queue' })
  handle() {
    return Promise.resolve();
  }
}

@Injectable()
class ColdHandler {
  @IntegrationEventHandler({ events: ['test.cold'], consumer: 'test.cold-queue' })
  handle() {
    return Promise.resolve();
  }
}

describe('Outbox com o Redis fora do ar (integração: Postgres e Redis)', () => {
  let ds: DataSource;
  let stopDb: () => Promise<void>;
  let redis: StartedRedisContainer;
  let proxy: TcpProxy;
  let app: TestingModule;
  let connection: QueueRedisConnection;
  let relay: OutboxRelay;
  let outbox: TypeOrmOutbox;

  // relógio controlável: a janela antiga de 2 min passa sem espera real
  let now = new Date('2026-01-01T12:00:00.000Z');
  const clock = { now: () => now };

  beforeAll(async () => {
    ({ ds, stop: stopDb } = await startOutboxDatabase());
    outbox = new TypeOrmOutbox(ds);
    redis = await startRedisContainer();
    proxy = await startTcpProxy(redis.getHost(), redis.getMappedPort(6379));
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: `redis://127.0.0.1:${proxy.port}`,
              QUEUE_WORKERS_ENABLED: 'false',
            }),
          ],
        }),
        TestLoggerModule,
        RedisModule,
        MessagingModule,
      ],
      providers: [WarmHandler, ColdHandler],
    }).compile();
    await app.init();
    connection = app.get(QueueRedisConnection);
    relay = new OutboxRelay(ds, app.get(EventPublisher), clock, logger, DEFAULT_OUTBOX_OPTIONS);
  }, 180_000);

  afterAll(async () => {
    await proxy?.open().catch(() => undefined);
    await app?.close();
    await proxy?.close();
    await redis?.stop();
    await stopDb?.();
  }, 60_000);

  beforeEach(async () => {
    await ds.query(`DELETE FROM shared.outbox`);
  });

  async function add(type: string) {
    const event: IntegrationEvent = {
      eventId: crypto.randomUUID(),
      type,
      version: 1,
      occurredAt: now.toISOString(),
      payload: {},
    };
    await outbox.add(crypto.randomUUID(), [event]);
    return event;
  }

  const row = async (id: string) =>
    (await ds.query(`SELECT * FROM shared.outbox WHERE id = $1`, [id]))[0];

  async function redisDown() {
    await proxy.close();
    await waitFor(() => connection.commands.status !== 'ready');
  }

  async function redisUp() {
    await proxy.open();
    await waitFor(() => connection.commands.status === 'ready');
  }

  /** O job do evento na fila do consumidor, lido direto no Redis, sem passar pelo proxy. */
  async function jobOf(event: IntegrationEvent, consumer: string) {
    const queue = new Queue(`events.${consumer}`, {
      connection: { url: redis.getConnectionUrl() },
    });
    try {
      return await queue.getJob(`${event.eventId}__${consumer}`);
    } finally {
      await queue.close();
    }
  }

  it('fila já usada: o Redis fora além da janela antiga não mata o evento, que sai na volta', async () => {
    const warm = await add('test.warm');
    expect(await relay.runOnce()).toBe(1);
    expect((await row(warm.eventId)).publishedAt).not.toBeNull();

    await redisDown();
    const event = await add('test.warm');
    // a janela antiga: a 8ª falha mataria a linha
    for (let round = 0; round < DEFAULT_OUTBOX_OPTIONS.maxAttempts; round++) {
      await expect(relay.runOnce()).rejects.toBeInstanceOf(EventTransportUnavailableError);
      now = new Date(now.getTime() + DEFAULT_OUTBOX_OPTIONS.maxDelayMs);
    }
    expect(await row(event.eventId)).toMatchObject({
      attempts: 0,
      deadAt: null,
      lastError: null,
      publishedAt: null,
    });

    await redisUp();
    expect(await relay.runOnce()).toBe(1);

    expect((await row(event.eventId)).publishedAt).toEqual(now);
    expect(await jobOf(event, 'test.warm-queue')).toMatchObject({
      data: { eventId: event.eventId },
    });
  });

  it('fila nova com o Redis fora: rejeita no prazo do publish, e a fila recriada entrega na volta', async () => {
    await redisDown();
    const event = await add('test.cold');

    const start = Date.now();
    await expect(relay.runOnce()).rejects.toBeInstanceOf(EventTransportUnavailableError);
    // o prazo de 5 s, com folga para a máquina carregada: sem ele, o publish esperaria o Redis voltar
    expect(Date.now() - start).toBeLessThan(15_000);
    expect(await row(event.eventId)).toMatchObject({ attempts: 0, deadAt: null });

    await redisUp();
    expect(await relay.runOnce()).toBe(1);

    expect((await row(event.eventId)).publishedAt).toEqual(now);
    expect(await jobOf(event, 'test.cold-queue')).toMatchObject({
      data: { eventId: event.eventId },
    });
  });
});
