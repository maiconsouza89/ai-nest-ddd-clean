import { TransactionManager } from '../../../../shared/application/ports/transaction-manager';
import { OrderRepository } from '../../domain/repositories/order.repository';
import { OrderActionInput } from '../dtos/order-action.input';
import { loadOwnedOrder } from '../order-access';

export class PayOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly tx: TransactionManager,
  ) {}

  async execute({ orderId, actor }: OrderActionInput) {
    // carregar, alterar e salvar na mesma transação
    await this.tx.run(async () => {
      const order = await loadOwnedOrder(this.repo, orderId, actor);
      order.pay();
      await this.repo.save(order);
    });
  }
}
