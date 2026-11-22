import { IntegrationEvent } from '#shared/application/integration-event';
import { Outbox } from '#shared/application/ports/outbox';

export class FakeOutbox implements Outbox {
  readonly events: IntegrationEvent[] = [];
  readonly aggregateIds: string[] = [];

  async add(aggregateId: string, events: IntegrationEvent[]) {
    this.aggregateIds.push(...events.map(() => aggregateId));
    this.events.push(...events);
  }
}
