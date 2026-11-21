import { IntegrationEvent } from '../../src/shared/application/integration-event';
import { Outbox } from '../../src/shared/application/ports/outbox';

export class FakeOutbox implements Outbox {
  readonly events: IntegrationEvent[] = [];

  async add(events: IntegrationEvent[]) {
    this.events.push(...events);
  }
}
