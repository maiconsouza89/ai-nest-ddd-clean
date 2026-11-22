import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IntegrationEvent } from '../../application/integration-event.js';
import { Logger } from '../../application/ports/logger.js';
import { EventPublisher } from '../../application/ports/event-publisher.js';
import { BullMqConnection } from './bullmq-connection.js';
import { EventSubscriptions, queueNameOf } from './event-subscriptions.js';

const QUEUE_JOB_OPTIONS = {
  // 10 tentativas com 2s, 4s, 8s...: cerca de 17 min até o job ir para `failed`
  attempts: 10,
  backoff: { type: 'exponential', delay: 2_000 },
  // o `jobId` só deduplica enquanto o job existir; depois disso vale o `processed_events`
  removeOnComplete: { age: 24 * 3600 },
  // o conjunto `failed` é a fila de mortos de cada consumidor
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;

/** `jobId` do BullMQ não aceita `:`. */
const jobIdOf = (eventId: string, consumer: string) => `${eventId}__${consumer}`;

/**
 * Enfileira (a ordem por agregado vale só até a fila: o retry com backoff pode reordenar dentro dela,
 * então nenhum consumidor pode depender da ordem).
 * o evento em uma fila por consumidor assinante. A outbox continua sendo a fonte da verdade:
 * se enfileirar falha, o evento fica pendente e o relay repete (o `jobId` evita o job duplicado).
 */
@Injectable()
export class BullMqPublisher implements EventPublisher, BeforeApplicationShutdown {
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly connection: BullMqConnection,
    private readonly subscriptions: EventSubscriptions,
    private readonly logger: Logger,
  ) {}

  async publish(event: IntegrationEvent) {
    const consumers = this.subscriptions.forEvent(event.type);
    // allSettled: um consumidor com problema não deve esconder os outros; o relay repete tudo e o
    // `jobId` ignora o que já foi enfileirado
    const results = await Promise.allSettled(
      consumers.map((consumer) =>
        this.queueFor(consumer.name).add(event.type, event, {
          ...QUEUE_JOB_OPTIONS,
          jobId: jobIdOf(event.eventId, consumer.name),
        }),
      ),
    );
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
  }

  async beforeApplicationShutdown() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }

  private queueFor(consumer: string) {
    let queue = this.queues.get(consumer);
    if (!queue) {
      queue = new Queue(queueNameOf(consumer), { connection: this.connection.producer });
      // erro de conexão sem listener derrubaria o processo
      queue.on('error', (err) => this.logger.warn({ err, consumer }, 'event queue error'));
      this.queues.set(consumer, queue);
    }
    return queue;
  }
}
