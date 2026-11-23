import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { BullMqConnection } from '../messaging/bullmq-connection.js';
import { withTimeout } from '../resilience/with-timeout.js';

// com o Redis fora do ar a chamada não rejeita, só fica pendente; sem limite a subida travaria calada
const REGISTER_TIMEOUT_MS = 10_000;

export type ScheduledJob = {
  /**
   * Fila só deste job. O Worker roda `run` para qualquer job da fila, então dois processors não
   * podem dividir uma: um segundo job no mesmo módulo precisa de outra fila.
   */
  queue: string;
  /** Id do agendador e nome dos jobs que ele gera, no formato `<módulo>.<tarefa>`. */
  scheduler: string;
  /** Expressão cron. */
  pattern: string;
};

/**
 * Gatilho agendado: o Job Scheduler do BullMQ gera um job por intervalo, e só um worker o pega,
 * então não há execução duplicada entre instâncias. O `upsertJobScheduler` é idempotente.
 * A subclasse só chama o caso de uso em `run`. Desligado com `JOBS_ENABLED=false`.
 */
export abstract class ScheduledJobProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;

  protected constructor(
    private readonly job: ScheduledJob,
    private readonly connection: BullMqConnection,
    protected readonly logger: Logger,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  protected abstract run(): Promise<void>;

  async onApplicationBootstrap() {
    if (this.config.get('JOBS_ENABLED', { infer: true }) !== 'true') return;

    const { queue: name, scheduler } = this.job;
    const queue = new Queue(name, { connection: this.connection.producer });
    queue.on('error', (err) => this.logger.warn({ err }, `${name} queue error`));
    try {
      // sem o agendador o job nunca roda: com o Redis fora do ar, a subida falha em vez de seguir calada
      await withTimeout(() => this.registerScheduler(queue), REGISTER_TIMEOUT_MS);
    } catch (error) {
      await queue.close().catch(() => undefined);
      throw new Error(`${scheduler}: scheduler registration failed`, { cause: error });
    }
    this.queue = queue;

    this.worker = new Worker(name, () => this.run(), { connection: this.connection.worker });
    this.worker.on('failed', (job, err) =>
      // o próximo disparo tenta de novo; o BullMQ guarda o job falho no histórico
      this.logger.error({ err, jobId: job?.id }, `${scheduler} failed`),
    );
    this.worker.on('error', (err) => this.logger.warn({ err }, `${name} worker error`));
  }

  private async registerScheduler(queue: Queue) {
    // um job por vez em todas as instâncias: o próximo disparo não começa por cima de uma execução longa
    await queue.setGlobalConcurrency(1);
    await queue.upsertJobScheduler(
      this.job.scheduler,
      { pattern: this.job.pattern },
      { name: this.job.scheduler, opts: { removeOnComplete: 20, removeOnFail: 100 } },
    );
  }

  // primeiro a parar: espera o job em andamento terminar, com as conexões ainda abertas
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
