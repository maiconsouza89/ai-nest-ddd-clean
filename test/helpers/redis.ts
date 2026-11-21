import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

// Sobe um Redis descartável, com a mesma política de memória do docker-compose.
export async function startRedis(): Promise<StartedRedisContainer> {
  return new RedisContainer('redis:8')
    .withCommand(['redis-server', '--maxmemory-policy', 'noeviction'])
    .start();
}
