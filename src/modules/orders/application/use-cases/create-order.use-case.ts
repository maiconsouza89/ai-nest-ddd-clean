import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Outbox } from '#shared/application/ports/outbox';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { Order } from '../../domain/entities/order.entity.js';
import { ProductNotFoundError } from '../../domain/errors/product-not-found.error.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { CreateOrderInput } from '../dtos/create-order.input.js';
import { publishOrderEvents } from '../events/publish-order-events.js';
import { PriceCatalog } from '../ports/price-catalog.js';

export class CreateOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly catalog: PriceCatalog,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
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

    // pedido e eventos na mesma transação: ou grava os dois, ou nenhum
    await this.tx.run(async () => {
      await this.repo.save(order);
      await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
    });
    return { id: order.id };
  }
}
