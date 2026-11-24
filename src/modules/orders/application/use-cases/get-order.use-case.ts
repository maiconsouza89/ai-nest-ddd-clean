import { OrderNotFoundError } from '../../domain/errors/order-not-found.error.js';
import { OrderActionInput } from '../dtos/order-action.input.js';
import { assertCanAccessOrder } from '../order-access.js';
import { OrderDetails, OrderQueries } from '../queries/order.queries.js';

export class GetOrderUseCase {
  constructor(private readonly queries: OrderQueries) {}

  async execute({ orderId, actor }: OrderActionInput): Promise<OrderDetails> {
    const order = await this.queries.getById(orderId);
    if (!order) throw new OrderNotFoundError();
    assertCanAccessOrder(actor, order.customerId);
    return order;
  }
}
