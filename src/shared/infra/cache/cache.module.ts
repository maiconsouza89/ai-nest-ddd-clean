import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { createKeyv } from '@keyv/redis';
import { Logger } from '../../application/ports/logger.js';
import { CacheRedisConnection } from '../redis/cache-redis.connection.js';

/**
 * Cache compartilhado entre instâncias, em Redis. Global: os módulos injetam `CACHE_MANAGER`.
 *
 * `throwOnErrors: false` faz uma falha do Redis virar miss (`get`) ou no-op (`set`/`del`) mais um
 * evento `error`, em vez de uma exceção na leitura.
 */
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [CacheRedisConnection, Logger],
      useFactory: (redis: CacheRedisConnection, logger: Logger) => {
        const store = createKeyv(redis.client, {
          throwOnErrors: false,
          throwOnConnectError: false,
        });
        // sem listener, o erro do store vira exceção não tratada
        store.on('error', (err: unknown) => logger.warn({ err }, 'cache store error'));
        return { stores: [store] };
      },
    }),
  ],
})
export class AppCacheModule {}
