import { Order } from '../entities/order.entity';

export abstract class OrderRepository {
  abstract save(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;
  /**
   * Como `findById`, mas trava a linha até o fim da transação ativa: quem alterar o pedido nesse
   * intervalo espera e depois falha por concorrência. Exige transação ativa.
   */
  abstract findByIdForUpdate(id: string): Promise<Order | null>;
  /** Ids de pedidos em DRAFT ou PLACED sem alteração desde `cutoff`, do mais antigo ao mais novo. */
  abstract findStaleIds(cutoff: Date, limit: number): Promise<string[]>;
}
