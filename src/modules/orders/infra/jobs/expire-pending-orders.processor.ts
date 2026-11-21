import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { Logger } from '../../../../shared/application/ports/logger';
import { EnvironmentVariables } from '../../../../shared/infra/config/env.validation';
import { BullMqConnection } from '../../../../shared/infra/messaging/bullmq-connection';
import { ExpirePendingOrdersUseCase } from '../../application/use-cases/expire-pending-orders.use-case';

export const ORDERS_JOBS_QUEUE = 'jobs.orders';
export const EXPIRE_PENDING_ORDERS_SCHEDULER = 'orders.expire-pending-orders';
const EVERY_5_MINUTES = '*/5 * * * *';
// com o Redis fora do ar a chamada não rejeita, só fica pendente; sem limite a subida travaria calada
const REGISTER_TIMEOUT_MS = 10_000;

/**
 * Gatilho agendado: o Job Scheduler do BullMQ gera um job por intervalo, e só um worker o pega,
 * então não há execução duplicada entre instâncias. O `upsertJobScheduler` é idempotente.
 * O processor só chama o caso de uso.
 */
@Injectable()
export class ExpirePendingOrdersProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly useCase: ExpirePendingOrdersUseCase,
    private readonly connection: BullMqConnection,
    private readonly logger: Logger,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get('JOBS_ENABLED', { infer: true }) !== 'true') return;

    this.queue = new Queue(ORDERS_JOBS_QUEUE, {
      connection: this.connection.producer,
    });
    this.queue.on('error', (err) => this.logger.warn({ err }, 'orders jobs queue error'));
    try {
      // sem o agendador o job nunca roda: com o Redis fora do ar, a subida falha em vez de seguir calada
      await withTimeout(
        this.registerScheduler(this.queue),
        REGISTER_TIMEOUT_MS,
        'orders job scheduler registration',
      );
    } catch (error) {
      await this.queue.close().catch(() => undefined);
      this.queue = undefined;
      throw error;
    }

    this.worker = new Worker(ORDERS_JOBS_QUEUE, () => this.process(), {
      connection: this.connection.worker,
    });
    this.worker.on('failed', (job, err) =>
      // o próximo disparo tenta de novo; o BullMQ guarda o job falho no histórico
      this.logger.error({ err, jobId: job?.id }, 'order expiration failed'),
    );
    this.worker.on('error', (err) => this.logger.warn({ err }, 'orders jobs worker error'));
  }

  private async registerScheduler(queue: Queue) {
    // um job por vez em todas as instâncias: o próximo disparo não começa por cima de uma execução longa
    await queue.setGlobalConcurrency(1);
    await queue.upsertJobScheduler(
      EXPIRE_PENDING_ORDERS_SCHEDULER,
      { pattern: EVERY_5_MINUTES },
      {
        name: EXPIRE_PENDING_ORDERS_SCHEDULER,
        opts: { removeOnComplete: 20, removeOnFail: 100 },
      },
    );
  }

  private async process() {
    const expired = await this.useCase.execute();
    if (expired > 0) this.logger.info({ expired }, 'expired pending orders');
  }

  // primeiro a parar: espera o job em andamento terminar, com as conexões ainda abertas
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
