import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '#shared/application/ports/logger';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';
import { ScheduledJobProcessor } from '#shared/infra/jobs/scheduled-job.processor';
import { BullMqConnection } from '#shared/infra/messaging/bullmq-connection';
import { ExpirePendingOrdersUseCase } from '../../application/use-cases/expire-pending-orders.use-case.js';

export const ORDERS_JOBS_QUEUE = 'jobs.orders';
export const EXPIRE_PENDING_ORDERS_SCHEDULER = 'orders.expire-pending-orders';

@Injectable()
export class ExpirePendingOrdersProcessor extends ScheduledJobProcessor {
  constructor(
    private readonly useCase: ExpirePendingOrdersUseCase,
    connection: BullMqConnection,
    logger: Logger,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super(
      {
        queue: ORDERS_JOBS_QUEUE,
        scheduler: EXPIRE_PENDING_ORDERS_SCHEDULER,
        pattern: '*/5 * * * *',
      },
      connection,
      logger,
      config,
    );
  }

  protected async run() {
    const expired = await this.useCase.execute();
    if (expired > 0) this.logger.info({ expired }, 'expired pending orders');
  }
}
