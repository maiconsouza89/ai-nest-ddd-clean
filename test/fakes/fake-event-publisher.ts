import { IntegrationEvent } from '#shared/application/integration-event';
import {
  EventPublisher,
  EventTransportUnavailableError,
} from '#shared/application/ports/event-publisher';

export class FakeEventPublisher implements EventPublisher {
  readonly delivered: IntegrationEvent[] = [];
  /** ids de eventos cuja entrega deve falhar */
  readonly failing = new Set<string>();
  /** com `true`, todo publish rejeita como o transporte fora do ar */
  unavailable = false;

  async publish(event: IntegrationEvent) {
    if (this.unavailable) throw new EventTransportUnavailableError(new Error('redis fora do ar'));
    if (this.failing.has(event.eventId)) throw new Error(`falha ao entregar ${event.eventId}`);
    this.delivered.push(event);
  }
}
