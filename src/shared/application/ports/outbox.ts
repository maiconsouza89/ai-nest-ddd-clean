import { IntegrationEvent } from '../integration-event';

export abstract class Outbox {
  /** Grava os eventos; dentro de um `tx.run`, entram na mesma transação do agregado. */
  abstract add(events: IntegrationEvent[]): Promise<void>;
}
