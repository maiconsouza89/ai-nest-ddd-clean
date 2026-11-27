import { Global, Module } from '@nestjs/common';
import { CacheRedisConnection } from './cache-redis.connection.js';
import { QueueRedisConnection } from './queue-redis.connection.js';

/**
 * Dono das conexões com o Redis: cria os clientes e os fecha no desligamento.
 *
 * Global também pela ordem do desligamento: os módulos `@Global` rodam cada hook por último, e o
 * `beforeApplicationShutdown` da `CacheRedisConnection` precisa rodar depois do atraso do Terminus.
 */
@Global()
@Module({
  providers: [CacheRedisConnection, QueueRedisConnection],
  exports: [CacheRedisConnection, QueueRedisConnection],
})
export class RedisModule {}
