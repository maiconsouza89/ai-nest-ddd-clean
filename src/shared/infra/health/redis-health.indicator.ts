import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { CacheRedisConnection } from '../redis/cache-redis.connection.js';
import { QueueRedisConnection } from '../redis/queue-redis.connection.js';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly cache: CacheRedisConnection,
    private readonly queue: QueueRedisConnection,
  ) {}

  /**
   * `PING` numa conexão com o Redis: o `client` do cache ou o `commands` das filas. Sem fila offline, o Redis
   * fora do ar falha na hora. O limite padrão é 1 s, como o do `TypeOrmHealthIndicator`, porque um Redis
   * conectado que não responde deixaria o `PING` pendurado.
   */
  pingCheck(key: string, connection: 'cache' | 'queue') {
    return this.indicators
      .check(key)
      .attempt(async () => {
        await (connection === 'cache' ? this.cache.client.ping() : this.queue.commands.ping());
      })
      .withTimeout(1000);
  }
}
