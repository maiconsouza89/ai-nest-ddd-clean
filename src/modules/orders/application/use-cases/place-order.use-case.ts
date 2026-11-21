import { OrderRepository } from '../../domain/repositories/order.repository';
import { OrderActionInput } from '../dtos/order-action.input';
import { loadOwnedOrder } from '../order-access';

export class PlaceOrderUseCase {
  constructor(private readonly repo: OrderRepository) {}

  async execute({ orderId, actor }: OrderActionInput) {
    const order = await loadOwnedOrder(this.repo, orderId, actor);
    order.place();
    await this.repo.save(order);
  }
}
