import { Order } from '../../../domain/entities/order.entity';
import { OrderRepository } from '../../../domain/repositories/order.repository';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order) {
    this.orders.set(order.id, order);
  }

  async findById(id: string) {
    return this.orders.get(id) ?? null;
  }
}
