import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { OrderCancelledV1 } from '../../contracts/events/order-cancelled.event';
import type { OrderCreatedV1 } from '../../contracts/events/order-created.event';
import type { OrderPaidV1 } from '../../contracts/events/order-paid.event';
import type { OrderPlacedV1 } from '../../contracts/events/order-placed.event';
import { CachedOrderQueries } from '../cache/cached-order.queries';

type OrderListChanged = OrderCreatedV1 | OrderPlacedV1 | OrderPaidV1 | OrderCancelledV1;

/**
 * Toda mudança que aparece na listagem de pedidos descarta o cache do cliente.
 * Trocar a geração é idempotente, então não precisa do `processed_events`.
 */
@Injectable()
export class InvalidateOrderListCacheHandler {
  constructor(private readonly queries: CachedOrderQueries) {}

  // suppressErrors:false: sem isso o erro some e o worker marca o evento como entregue
  @OnEvent('orders.order-created', { suppressErrors: false })
  @OnEvent('orders.order-placed', { suppressErrors: false })
  @OnEvent('orders.order-paid', { suppressErrors: false })
  @OnEvent('orders.order-cancelled', { suppressErrors: false })
  onOrderListChanged(event: OrderListChanged) {
    return this.queries.invalidate(event.payload.customerId);
  }
}
