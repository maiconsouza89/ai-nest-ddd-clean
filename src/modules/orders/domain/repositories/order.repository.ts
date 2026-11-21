import { Order } from '../entities/order.entity';

export abstract class OrderRepository {
  abstract save(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;
  /** Ids de pedidos em DRAFT ou PLACED sem alteração desde `cutoff`, do mais antigo ao mais novo. */
  abstract findStaleIds(cutoff: Date, limit: number): Promise<string[]>;
}
