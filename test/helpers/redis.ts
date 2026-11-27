import { Global, Module } from '@nestjs/common';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { inject } from 'vitest';
import { QueueRedisConnection } from '#shared/infra/redis/queue-redis.connection';

// Um banco lógico por worker, sem módulo: o padrão do Redis (16) colidiria em máquinas com 18 threads ou mais,
// onde o Vitest abre mais de 16 workers. O banco 0 fica sem uso (o VITEST_POOL_ID começa em 1).
const REDIS_DATABASES = 128;

/**
 * O banco lógico deste worker no Redis compartilhado (test/global-setup/int.ts), limpo com FLUSHDB.
 * Arquivos em workers diferentes não se enxergam; os do mesmo worker rodam um depois do outro.
 */
export async function startRedis(): Promise<string> {
  const index = Number(process.env.VITEST_POOL_ID ?? 0);
  if (index >= REDIS_DATABASES)
    throw new Error(`VITEST_POOL_ID ${index} sem banco lógico no Redis: suba o REDIS_DATABASES`);
  const url = `${inject('redisUrl')}/${index}`;
  const client = new Redis(url);
  try {
    await client.flushdb();
  } finally {
    client.disconnect();
  }
  return url;
}

/**
 * Um container de Redis com a política de memória do docker-compose: o compartilhado do globalSetup, ou um
 * só do arquivo, para o teste que o derruba no meio.
 */
export function startRedisContainer(): Promise<StartedRedisContainer> {
  return new RedisContainer('redis:8')
    .withCommand([
      'redis-server',
      '--maxmemory-policy',
      'noeviction',
      '--databases',
      String(REDIS_DATABASES),
    ])
    .start();
}

/**
 * Só a conexão das filas, global como no `RedisModule`, para o teste que monta o `MessagingModule` sem o cache.
 * O `RedisModule` abriria também o cliente do cache, que só o cache fecha no desligamento.
 */
@Global()
@Module({ providers: [QueueRedisConnection], exports: [QueueRedisConnection] })
export class QueueRedisTestModule {}
