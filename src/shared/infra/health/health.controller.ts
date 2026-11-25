import { Controller, Get, Res, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
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

  /**
   * O processo está vivo. Não consulta dependências e não passa pelo Terminus, que responderia 503
   * durante o atraso do desligamento: ali só o ready deve falhar.
   */
  @Get('live')
  // sem a documentação do Terminus, que anunciaria um 503 que esta rota não responde
  @HealthCheck({ swaggerDocumentation: false })
  @ApiOkResponse({ description: 'O processo está vivo' })
  live() {
    return { status: 'ok', info: {}, error: {}, details: {} } satisfies HealthCheckResult;
  }

  /**
   * O processo pode receber tráfego: o banco e o Redis respondem, e a app não está desligando.
   *
   * Responde o resultado do Terminus como ele é, inclusive no 503 (dependência fora ou app
   * desligando). O 503 não passa pelo `ProblemDetailsFilter`: a resposta mantém os indicadores, e o
   * Terminus já loga a falha.
   */
  @Get('ready')
  @HealthCheck()
  async ready(@Res() res: Response) {
    try {
      res
        .status(200)
        .json(
          await this.health.check([
            () => this.db.pingCheck('database').withTimeout(1000),
            () => this.redis.pingCheck('redis').withTimeout(1000),
          ]),
        );
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      res.status(503).json(error.getResponse());
    }
  }
}
