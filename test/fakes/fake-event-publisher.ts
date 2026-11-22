import { IntegrationEvent } from '#shared/application/integration-event';
import { EventPublisher } from '#shared/application/ports/event-publisher';

export class FakeEventPublisher implements EventPublisher {
  readonly delivered: IntegrationEvent[] = [];
  /** ids de eventos cuja entrega deve falhar */
  readonly failing = new Set<string>();

  async publish(event: IntegrationEvent) {
    if (this.failing.has(event.eventId)) throw new Error(`falha ao entregar ${event.eventId}`);
    this.delivered.push(event);
  }
}
