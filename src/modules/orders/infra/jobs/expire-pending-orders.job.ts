import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnvironmentVariables } from '../../../../shared/infra/config/env.validation';
import { PgAdvisoryLock } from '../../../../shared/infra/database/pg-advisory-lock';
import { ExpirePendingOrdersUseCase } from '../../application/use-cases/expire-pending-orders.use-case';

const LOCK_KEY = 'orders.expire-pending-orders';

/** Gatilho agendado: só chama o caso de uso, sob um lock para não duplicar entre instâncias. */
@Injectable()
export class ExpirePendingOrdersJob {
  private readonly logger = new Logger(ExpirePendingOrdersJob.name);

  constructor(
    private readonly useCase: ExpirePendingOrdersUseCase,
    private readonly lock: PgAdvisoryLock,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'expire-pending-orders', waitForCompletion: true })
  async run() {
    if (this.config.get('JOBS_ENABLED', { infer: true }) !== 'true') return;
    try {
      const ran = await this.lock.runExclusive(LOCK_KEY, async () => {
        const expired = await this.useCase.execute();
        if (expired > 0) this.logger.log(`Expired ${expired} pending orders`);
      });
      if (!ran) this.logger.debug('Another instance is already expiring orders');
    } catch (error) {
      // o cron não deve derrubar o processo; a próxima execução tenta de novo
      this.logger.error('Order expiration failed', error instanceof Error ? error.stack : error);
    }
  }
}
