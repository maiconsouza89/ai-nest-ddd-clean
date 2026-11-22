import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startRedis } from '#test/helpers/redis';
import { RedisThrottlerStorage } from './redis-throttler-storage.js';

const TTL = 60_000;

describe('RedisThrottlerStorage (integração: Redis)', () => {
  let redis: StartedRedisContainer;
  let clients: Redis[] = [];
  const logger = new FakeLogger();

  // cada "instância" da aplicação tem a sua conexão e o seu storage
  const instance = async () => {
    const client = new Redis(redis.getConnectionUrl(), { enableOfflineQueue: false });
    clients.push(client);
    // sem fila offline, um comando enviado antes da conexão falha
    if (client.status !== 'ready') await new Promise((resolve) => client.once('ready', resolve));
    return new RedisThrottlerStorage(client, logger);
  };

  beforeAll(async () => {
    redis = await startRedis();
  }, 180_000);

  afterEach(async () => {
    const admin = new Redis(redis.getConnectionUrl());
    await admin.flushall();
    admin.disconnect();
    clients.forEach((c) => c.disconnect());
    clients = [];
  });

  afterAll(async () => {
    await redis?.stop();
  }, 60_000);

  it('o limite vale para a soma de duas instâncias', async () => {
    const a = await instance();
    const b = await instance();

    await a.increment('login:1.1.1.1', TTL, 3, TTL, 'default');
    await b.increment('login:1.1.1.1', TTL, 3, TTL, 'default');
    const third = await a.increment('login:1.1.1.1', TTL, 3, TTL, 'default');
    const fourth = await b.increment('login:1.1.1.1', TTL, 3, TTL, 'default');

    expect(third).toMatchObject({ totalHits: 3, isBlocked: false });
    expect(fourth).toMatchObject({ totalHits: 4, isBlocked: true });
    expect(fourth.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('chaves e throttlers diferentes contam separado', async () => {
    const a = await instance();
    await a.increment('k1', TTL, 1, TTL, 'default');

    expect(await a.increment('k2', TTL, 1, TTL, 'default')).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
    expect(await a.increment('k1', TTL, 1, TTL, 'other')).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });

  it('durante o bloqueio os acessos não são contados, e a janela expira', async () => {
    const a = await instance();
    await a.increment('k', 300, 1, 300, 'default');
    await a.increment('k', 300, 1, 300, 'default');

    expect(await a.increment('k', 300, 1, 300, 'default')).toMatchObject({
      totalHits: 2,
      isBlocked: true,
    });

    await new Promise((r) => setTimeout(r, 400));
    expect(await a.increment('k', 300, 1, 300, 'default')).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });

  it('Redis fora do ar: falha fechada com 503', async () => {
    const down = new Redis('redis://127.0.0.1:1', {
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    down.on('error', () => undefined);
    clients.push(down);

    await expect(
      new RedisThrottlerStorage(down, logger).increment('k', TTL, 5, TTL, 'default'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
