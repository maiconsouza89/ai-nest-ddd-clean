import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { IntegrationEvent } from '../../application/integration-event.js';
import { Logger } from '../../application/ports/logger.js';
import {
  EventPublisher,
  EventTransportUnavailableError,
} from '../../application/ports/event-publisher.js';
import { withTimeout } from '../resilience/with-timeout.js';
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

/**
 * Prazo de cada `add`. Protege a transação do lote do relay, que fica aberta durante o publish: um Redis
 * congelado (sem RST) penduraria o `add` sem fim, e a fila criada com o Redis fora espera a conexão. O `add` não é
 * cancelado: se terminar depois do prazo, a próxima rodada o encontra pelo `jobId` e não duplica o job.
 */
const ENQUEUE_TIMEOUT_MS = 5_000;

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
        withTimeout(
          () =>
            this.queueFor(consumer.name).add(event.type, event, {
              ...QUEUE_JOB_OPTIONS,
              jobId: jobIdOf(event.eventId, consumer.name),
            }),
          ENQUEUE_TIMEOUT_MS,
        ),
      ),
    );
    // lido depois do allSettled: é o estado da conexão quando os erros chegaram
    const status = this.connection.producer.status;
    const failures = results.flatMap((result, i) =>
      result.status === 'rejected'
        ? [
            {
              consumer: consumers[i].name,
              error: result.reason as unknown,
              transport: isTransportFailure(result.reason, status),
            },
          ]
        : [],
    );
    for (const failure of failures) if (failure.transport) this.discardQueue(failure.consumer);
    // basta um consumidor fora por transporte: o relay repete o evento inteiro, e o `jobId` ignora o que entrou
    const transport = failures.find((failure) => failure.transport);
    if (transport) throw new EventTransportUnavailableError(transport.error);
    if (failures.length > 0) throw failures[0].error;
  }

  async beforeApplicationShutdown() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }

  /**
   * Tira a fila do consumidor depois de uma queda do Redis, e o próximo publish cria outra. Se a conexão cai no
   * meio da inicialização da `Queue`, ela fica rejeitada para sempre, mesmo com o Redis de volta. Fechar não fecha
   * o `producer`: o BullMQ não fecha uma conexão recebida pronta.
   */
  private discardQueue(consumer: string) {
    const queue = this.queues.get(consumer);
    this.queues.delete(consumer);
    void queue?.close().catch(() => undefined);
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
