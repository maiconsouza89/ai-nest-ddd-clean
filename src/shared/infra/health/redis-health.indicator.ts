import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { CacheRedisConnection } from '../redis/cache-redis.connection.js';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly redis: CacheRedisConnection,
  ) {}

  /**
   * `PING` no Redis. Sem fila offline, o Redis fora do ar falha na hora. O limite padrão é 1 s, como o do
   * `TypeOrmHealthIndicator`, porque um Redis conectado que não responde deixaria o `PING` pendurado.
   */
  pingCheck(key: string) {
    return this.indicators
      .check(key)
      .attempt(async () => {
        await this.redis.client.ping();
      })
      .withTimeout(1000);
  }
}
