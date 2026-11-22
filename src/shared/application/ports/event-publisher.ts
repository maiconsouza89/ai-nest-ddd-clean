import { IntegrationEvent } from '../integration-event.js';

export abstract class EventPublisher {
  /** Entrega o evento aos interessados. Se rejeitar, o worker tenta de novo mais tarde. */
  abstract publish(event: IntegrationEvent): Promise<void>;
}
