import { Controller, Get, Res, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type { Response } from 'express';
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
  live(@Res() res: Response) {
    return this.reply(res, () => this.health.check([]));
  }

  /** O processo pode receber tráfego: o banco e o Redis respondem. */
  @Get('ready')
  @HealthCheck()
  ready(@Res() res: Response) {
    return this.reply(res, () =>
      this.health.check([
        () => this.db.pingCheck('database').withTimeout(1000),
        () => this.redis.pingCheck('redis').withTimeout(1000),
      ]),
    );
  }

  /**
   * Responde o resultado do Terminus como ele é, inclusive no 503 (dependência fora ou app
   * desligando). O 503 não passa pelo `ProblemDetailsFilter`: a resposta mantém os indicadores, e o
   * Terminus já loga a falha.
   */
  private async reply(res: Response, check: () => Promise<HealthCheckResult>) {
    try {
      res.status(200).json(await check());
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      res.status(503).json(error.getResponse());
    }
  }
}
