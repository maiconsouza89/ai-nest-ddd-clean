import { TransactionManager } from '../../../../shared/application/ports/transaction-manager';
import { StockGateway } from '../ports/stock-gateway';
import { OrderRepository } from '../../domain/repositories/order.repository';
import { OrderActionInput } from '../dtos/order-action.input';
import { loadOwnedOrder } from '../order-access';

export class PlaceOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly stock: StockGateway,
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
    });
  }
}
