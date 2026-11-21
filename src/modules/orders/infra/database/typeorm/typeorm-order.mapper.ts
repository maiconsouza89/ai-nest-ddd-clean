import { Money } from '../../../../../shared/domain/money.vo';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatus } from '../../../domain/value-objects/order-status.vo';
import { OrderItemOrmEntity } from './entities/order-item.orm-entity';
import { OrderOrmEntity } from './entities/order.orm-entity';

export class OrderMapper {
  static toDomain(raw: OrderOrmEntity): Order {
    return Order.restore({
      id: raw.id,
      customerId: raw.customerId,
      status: raw.status as OrderStatus,
      version: raw.version,
      items: raw.items.map(
        (i) =>
          new OrderItem(i.productId, i.qty, Money.fromCents(Number(i.unitPriceCents), i.currency)),
      ),
    });
  }

  static toPersistence(order: Order): OrderOrmEntity {
    const raw = new OrderOrmEntity();
    raw.id = order.id;
    raw.customerId = order.customerId;
    raw.status = order.status;
    raw.version = order.version;
    raw.items = order.items.map((i) => {
      const item = new OrderItemOrmEntity();
      item.orderId = order.id;
      item.productId = i.productId;
      item.qty = i.qty;
      item.unitPriceCents = String(i.unitPrice.cents);
      item.currency = i.unitPrice.currency;
      return item;
    });
    return raw;
  }
}
