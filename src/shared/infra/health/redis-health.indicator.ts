import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisConnection } from '../cache/redis.connection.js';
import { withTimeout } from '../resilience/with-timeout.js';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly redis: RedisConnection,
  ) {}

  /** `PING` com limite de tempo. Sem fila offline, o Redis fora do ar falha na hora. */
  async pingCheck(key: string, { timeout }: { timeout: number }) {
    const indicator = this.indicators.check(key);
    try {
      await withTimeout(() => this.redis.client.ping(), timeout);
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: err instanceof Error ? err.message : 'redis unreachable' });
    }
  }
}
