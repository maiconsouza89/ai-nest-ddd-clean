import { Order } from '../../../domain/entities/order.entity';
import { OrderRepository } from '../../../domain/repositories/order.repository';
import { EXPIRABLE_STATUSES } from '../../../domain/value-objects/order-status.vo';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, { order: Order; savedAt: Date }>();

  // `now` permite aos testes controlar o "relógio do banco" usado para medir o tempo parado
  constructor(private readonly now: () => Date = () => new Date()) {}

  async save(order: Order) {
    this.orders.set(order.id, { order, savedAt: this.now() });
  }

  async findById(id: string) {
    return this.orders.get(id)?.order ?? null;
  }

  findByIdForUpdate(id: string) {
    return this.findById(id);
  }

  async findStaleIds(cutoff: Date, limit: number) {
    return [...this.orders.values()]
      .filter(
        ({ order, savedAt }) =>
          EXPIRABLE_STATUSES.includes(order.status) && savedAt < cutoff,
      )
      .sort((a, b) => a.savedAt.getTime() - b.savedAt.getTime())
      .slice(0, limit)
      .map(({ order }) => order.id);
  }
}
