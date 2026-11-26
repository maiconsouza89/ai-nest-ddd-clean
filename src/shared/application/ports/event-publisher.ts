import { IntegrationEvent } from '../integration-event.js';

/**
 * O transporte dos eventos (o Redis, no adapter do BullMQ) está fora do ar. A falha é da infraestrutura, e não
 * do evento: o relay da outbox pausa sem contar a tentativa da linha. A causa original fica no `cause`.
 */
export class EventTransportUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `event transport unavailable: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = 'EventTransportUnavailableError';
  }
}

export abstract class EventPublisher {
  /**
   * Entrega o evento aos interessados. Rejeita com `EventTransportUnavailableError` quando o transporte está fora
   * do ar: o worker da outbox espera e tenta de novo, sem contar a falha da linha. Qualquer outra rejeição conta
   * como falha da linha, e o worker tenta de novo com backoff, até o limite de falhas.
   */
  abstract publish(event: IntegrationEvent): Promise<void>;
}
