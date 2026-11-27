import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startRedis } from '#test/helpers/redis';
import { waitFor } from '#test/helpers/wait-for';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';
import { QueueRedisConnection } from '#shared/infra/redis/queue-redis.connection';
import { ExpirePendingOrdersUseCase } from '../../application/use-cases/expire-pending-orders.use-case.js';
import {
  EXPIRE_PENDING_ORDERS_SCHEDULER,
  ExpirePendingOrdersProcessor,
  ORDERS_JOBS_QUEUE,
} from './expire-pending-orders.processor.js';

describe('Job de expiração de pedidos com BullMQ (integração: Redis)', () => {
  let redisUrl: string;
  let probe: Queue;
  let instances: {
    processor: ExpirePendingOrdersProcessor;
    connection: QueueRedisConnection;
  }[] = [];
  const execute = vi.fn<() => Promise<number>>();

  const boot = async (jobsEnabled = 'true') => {
    const logger = new FakeLogger();
    const config = new ConfigService({
      REDIS_URL: redisUrl,
      JOBS_ENABLED: jobsEnabled,
    }) as unknown as ConfigService<EnvironmentVariables, true>;
    const connection = new QueueRedisConnection(config, logger);
    const processor = new ExpirePendingOrdersProcessor(
      { execute } as unknown as ExpirePendingOrdersUseCase,
      connection,
      logger,
      config,
    );
    await processor.onApplicationBootstrap();
    instances.push({ processor, connection });
  };

  beforeAll(async () => {
    redisUrl = await startRedis();
    probe = new Queue(ORDERS_JOBS_QUEUE, {
      connection: { url: redisUrl },
    });
  });

  afterEach(async () => {
    for (const { processor, connection } of instances) {
      await processor.onModuleDestroy();
      connection.onApplicationShutdown();
    }
    instances = [];
    await probe.obliterate({ force: true });
    execute.mockReset();
  });

  afterAll(async () => {
    await probe?.close();
  });

  it('duas instâncias registram um único agendador', async () => {
    await boot();
    await boot();

    const schedulers = await probe.getJobSchedulers();

    expect(schedulers.map((s) => s.key)).toEqual([EXPIRE_PENDING_ORDERS_SCHEDULER]);
    expect(schedulers[0].pattern).toBe('*/5 * * * *');
    // o próprio agendador já deixou o próximo disparo na fila, com o nome que o worker processa
    const delayed = await probe.getDelayed();
    expect(delayed.map((j) => j.name)).toEqual([EXPIRE_PENDING_ORDERS_SCHEDULER]);
  });

  it('cada disparo roda o caso de uso uma vez só, mesmo com duas instâncias', async () => {
    execute.mockResolvedValue(0);
    await boot();
    await boot();

    await probe.add(EXPIRE_PENDING_ORDERS_SCHEDULER, {});
    await waitFor(() => execute.mock.calls.length === 1);
    // dá tempo de uma execução duplicada (que não deveria existir) aparecer
    await new Promise((r) => setTimeout(r, 500));

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('uma falha do caso de uso não derruba o worker: o próximo disparo roda', async () => {
    execute.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(0);
    await boot();

    await probe.add(EXPIRE_PENDING_ORDERS_SCHEDULER, {});
    await probe.add(EXPIRE_PENDING_ORDERS_SCHEDULER, {});

    await waitFor(() => execute.mock.calls.length === 2);
  });

  it('com JOBS_ENABLED=false não registra agendador nem processa', async () => {
    await boot('false');

    await probe.add(EXPIRE_PENDING_ORDERS_SCHEDULER, {});
    await new Promise((r) => setTimeout(r, 500));

    expect(await probe.getJobSchedulers()).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});
