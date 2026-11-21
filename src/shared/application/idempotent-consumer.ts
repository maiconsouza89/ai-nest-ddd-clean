import { IntegrationEvent } from './integration-event';
import { Logger } from './ports/logger';
import { ProcessedEvents } from './ports/processed-events';
import { TransactionManager } from './ports/transaction-manager';

/**
 * Faz o handler produzir o efeito uma vez só, mesmo que a outbox entregue o evento duas vezes.
 * A marca e o efeito ficam na mesma transação: se o efeito falhar, a marca desfaz e o retry reprocessa.
 */
export class IdempotentConsumer {
  constructor(
    private readonly tx: TransactionManager,
    private readonly processed: ProcessedEvents,
    private readonly logger: Logger,
  ) {}

  handle<E extends IntegrationEvent>(
    consumer: string,
    event: E,
    work: (event: E) => Promise<void>,
  ) {
    return this.tx.run(async () => {
      // só a constraint UNIQUE resolve a corrida entre duas entregas simultâneas
      if (!(await this.processed.tryMark(event.eventId, consumer))) {
        this.logger.info(
          { consumer, eventId: event.eventId, type: event.type },
          'duplicate event skipped',
        );
        return;
      }
      await work(event);
    });
  }
}
