import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Logger } from '#shared/application/ports/logger';
import { Outbox } from '#shared/application/ports/outbox';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { DomainError } from '#shared/domain/domain-error';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { publishOrderEvents } from '../events/publish-order-events.js';

export type ExpirePendingOrdersOptions = {
  /** Tempo parado, em ms, a partir do qual um DRAFT/PLACED expira. */
  maxIdleMs: number;
  /** Quantos pedidos tratar por execução; o resto fica para a próxima. */
  batchSize: number;
};

export class ExpirePendingOrdersUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
    private readonly logger: Logger,
    private readonly options: ExpirePendingOrdersOptions,
  ) {}

  /** Cancela os pedidos parados e devolve quantos foram cancelados. */
  async execute(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - this.options.maxIdleMs);
    const staleIds = await this.repo.findStaleIds(cutoff, this.options.batchSize);

    let expired = 0;
    for (const orderId of staleIds) {
      // uma transação por pedido: a falha de um não desfaz os outros
      try {
        await this.tx.run(async () => {
          const order = await this.repo.findById(orderId);
          if (!order) return;
          // cancelar emite OrderCancelled, e é por ele que o inventory devolve o estoque
          order.cancel();
          await this.repo.save(order);
          await publishOrderEvents(order, {
            outbox: this.outbox,
            ids: this.ids,
            clock: this.clock,
          });
        });
        expired++;
      } catch (error) {
        // pago ou cancelado desde a listagem, ou alterado no meio (ConcurrencyError também é
        // DomainError): não há mais o que expirar. O resto é falha de verdade, só registrada
        if (error instanceof DomainError) {
          this.logger.warn({ orderId, reason: error.constructor.name }, 'Order expiration skipped');
        } else {
          // um pedido com falha não pode travar os que vêm depois dele na fila
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error({ orderId, error: message }, 'Order expiration failed');
        }
      }
    }
    return expired;
  }
}
