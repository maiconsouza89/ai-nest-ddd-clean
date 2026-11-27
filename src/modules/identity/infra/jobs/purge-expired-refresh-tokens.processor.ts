import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '#shared/application/ports/logger';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';
import { ScheduledJobProcessor } from '#shared/infra/jobs/scheduled-job.processor';
import { QueueRedisConnection } from '#shared/infra/redis/queue-redis.connection';
import { PurgeExpiredRefreshTokensUseCase } from '../../application/use-cases/purge-expired-refresh-tokens.use-case.js';

@Injectable()
export class PurgeExpiredRefreshTokensProcessor extends ScheduledJobProcessor {
  constructor(
    private readonly useCase: PurgeExpiredRefreshTokensUseCase,
    connection: QueueRedisConnection,
    logger: Logger,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super(
      {
        queue: 'jobs.identity',
        scheduler: 'identity.purge-expired-refresh-tokens',
        pattern: '0 3 * * *', // uma vez por dia, às 3h
      },
      connection,
      logger,
      config,
    );
  }

  protected async run() {
    const purged = await this.useCase.execute();
    if (purged > 0) this.logger.info({ purged }, 'purged expired refresh tokens');
  }
}
