import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { Outbox } from '../../../../shared/application/ports/outbox';
import { TransactionManager } from '../../../../shared/application/ports/transaction-manager';
import { OrderRepository } from '../../domain/repositories/order.repository';
import { OrderActionInput } from '../dtos/order-action.input';
import { toIntegrationEvent } from '../events/to-integration-event';
import { loadOwnedOrder } from '../order-access';

export class PayOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
  ) {}

  async execute({ orderId, actor }: OrderActionInput) {
    // pedido e eventos na mesma transação: ou grava os dois, ou nenhum
    await this.tx.run(async () => {
      const order = await loadOwnedOrder(this.repo, orderId, actor);
      order.pay();
      await this.repo.save(order);
      const occurredAt = this.clock.now();
      const events = order
        .pullEvents()
        .map((e) => toIntegrationEvent(e, { eventId: this.ids.next(), occurredAt }));
      await this.outbox.add(events);
    });
  }
}
