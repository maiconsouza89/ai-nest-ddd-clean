import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../auth/public.decorator.js';
import { RedisHealthIndicator } from './redis-health.indicator.js';

// sondas do orquestrador: sem JWT, sem versão na URL e fora do rate limit
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /** O processo está vivo. Não consulta dependências. */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /** O processo pode receber tráfego: o banco e o Redis respondem. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1000 }),
      () => this.redis.pingCheck('redis', { timeout: 1000 }),
    ]);
  }
}
