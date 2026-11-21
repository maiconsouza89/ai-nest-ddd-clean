import { IntegrationEvent } from '../integration-event';

export abstract class Outbox {
  /**
   * Grava os eventos de um agregado; dentro de um `tx.run`, entram na mesma transação dele.
   * Os eventos do mesmo `aggregateId` são publicados na ordem em que foram gravados.
   */
  abstract add(aggregateId: string, events: IntegrationEvent[]): Promise<void>;
}
