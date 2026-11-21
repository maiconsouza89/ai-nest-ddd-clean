import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../../shared/application/ports/transaction-manager';
import { Order } from '../../domain/entities/order.entity';
import { ProductNotFoundError } from '../../domain/errors/product-not-found.error';
import { OrderRepository } from '../../domain/repositories/order.repository';
import { CreateOrderInput } from '../dtos/create-order.input';
import { PriceCatalog } from '../ports/price-catalog';

export class CreateOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly catalog: PriceCatalog,
    private readonly ids: IdGenerator,
    private readonly tx: TransactionManager,
  ) {}

  async execute(input: CreateOrderInput) {
    const order = Order.create(this.ids.next(), input.customerId);
    const prices = await this.catalog.pricesOf(input.items.map((i) => i.productId));

    for (const item of input.items) {
      const price = prices.get(item.productId);
      if (!price) throw new ProductNotFoundError(item.productId);
      order.addItem(item.productId, item.qty, price);
    }

    await this.tx.run(() => this.repo.save(order));
    return { id: order.id };
  }
}
