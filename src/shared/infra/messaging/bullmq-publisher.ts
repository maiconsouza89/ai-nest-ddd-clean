import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { IntegrationEvent } from '../../application/integration-event.js';
import { Logger } from '../../application/ports/logger.js';
import {
  EventPublisher,
  EventTransportUnavailableError,
} from '../../application/ports/event-publisher.js';
import { BullMqConnection } from './bullmq-connection.js';
import { EventSubscriptions, openEventQueue } from './event-subscriptions.js';
import { isTransportFailure } from './transport-failure.js';

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
 * Enfileira o evento em uma fila por consumidor assinante. A outbox continua sendo a fonte da verdade:
 * se enfileirar falha, o evento fica pendente e o relay repete (o `jobId` evita o job duplicado). Com o Redis
 * fora do ar, o publish rejeita com `EventTransportUnavailableError`, e o relay pausa sem contar a falha.
 * A ordem por agregado vale só até a fila: o retry com backoff pode reordenar dentro dela, então
 * nenhum consumidor pode depender da ordem.
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
    const failures = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason as unknown);
    if (failures.length === 0) return;
    // lido depois do allSettled: é o estado da conexão quando os erros chegaram
    const status = this.connection.producer.status;
    const transport = failures.find((error) => isTransportFailure(error, status));
    // basta um consumidor fora por transporte: o relay repete o evento inteiro, e o `jobId` ignora o que entrou
    if (transport !== undefined) throw new EventTransportUnavailableError(transport);
    throw failures[0];
  }

  async beforeApplicationShutdown() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }

  private queueFor(consumer: string) {
    let queue = this.queues.get(consumer);
    if (!queue) {
      queue = openEventQueue(consumer, this.connection.producer, this.logger);
      this.queues.set(consumer, queue);
    }
    return queue;
  }
}
