import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { IntegrationEvent } from '../../application/integration-event';
import { Logger } from '../../application/ports/logger';
import { EnvironmentVariables } from '../config/env.validation';
import { runInEventTrace } from '../observability/trace-context';
import { BullMqConnection } from './bullmq-connection';
import { EventSubscriptions, queueNameOf } from './event-subscriptions';

/** Um worker por consumidor. Cada um tem retry, backoff e fila de mortos próprios. */
@Injectable()
export class EventWorkers implements OnApplicationBootstrap, OnModuleDestroy {
  private workers: Worker[] = [];

  constructor(
    private readonly subscriptions: EventSubscriptions,
    private readonly connection: BullMqConnection,
    private readonly logger: Logger,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('QUEUE_WORKERS_ENABLED') !== 'true') return;
    this.workers = this.subscriptions.all().map((consumer) => {
      const worker = new Worker<IntegrationEvent>(
        queueNameOf(consumer.name),
        (job) =>
          runInEventTrace(
            `${consumer.name} process ${job.data.type}`,
            job.data.metadata?.traceparent,
            { 'messaging.message.id': job.data.eventId, 'messaging.operation': 'process' },
            () => {
              this.logger.info(
                { consumer: consumer.name, eventId: job.data.eventId, type: job.data.type, attempt: job.attemptsMade + 1 },
                'processing event',
              );
              return consumer.handle(job.data);
            },
          ),
        { connection: this.connection.worker },
      );
      worker.on('failed', (job, err) => {
        const exhausted = job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);
        const fields = { consumer: consumer.name, eventId: job?.data.eventId, type: job?.data.type, err };
        if (exhausted) this.logger.error(fields, 'event dead-lettered after max attempts');
        else this.logger.warn(fields, 'event processing failed, will retry');
      });
      worker.on('error', (err) => this.logger.warn({ consumer: consumer.name, err }, 'queue worker error'));
      return worker;
    });
  }

  // primeiro a parar: espera os jobs em andamento terminarem, com as conexões ainda abertas
  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
