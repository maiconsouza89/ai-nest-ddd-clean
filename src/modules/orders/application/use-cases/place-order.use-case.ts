import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Outbox } from '#shared/application/ports/outbox';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { StockGateway } from '../ports/stock-gateway.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { OrderActionInput } from '../dtos/order-action.input.js';
import { publishOrderEvents } from '../events/publish-order-events.js';
import { loadOwnedOrder } from '../order-access.js';

export class PlaceOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly stock: StockGateway,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
  ) {}

  async execute({ orderId, actor }: OrderActionInput) {
    // carregar, alterar e salvar na mesma transação
    await this.tx.run(async () => {
      const order = await loadOwnedOrder(this.repo, orderId, actor);
      // reserva antes de fechar: se faltar estoque, o pedido continua como estava
      await this.stock.reserve(
        order.id,
        order.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      );
      order.place();
      await this.repo.save(order);
      await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
    });
  }
}
