import { DomainEvent } from '../../../../shared/domain/domain-event';
import { OrderCancelledV1 } from '../../contracts/events/order-cancelled.event';
import { OrderCreatedV1 } from '../../contracts/events/order-created.event';
import { OrderPaidV1 } from '../../contracts/events/order-paid.event';
import { OrderPlacedV1 } from '../../contracts/events/order-placed.event';
import { OrderCancelled } from '../../domain/events/order-cancelled.event';
import { OrderCreated } from '../../domain/events/order-created.event';
import { OrderPaid } from '../../domain/events/order-paid.event';
import { OrderPlaced } from '../../domain/events/order-placed.event';

type Meta = { eventId: string; occurredAt: Date };

/** Converte o evento de domínio no contrato público. Eventos sem contrato falham alto. */
export function toIntegrationEvent(
  event: DomainEvent,
  meta: Meta,
): OrderCreatedV1 | OrderPlacedV1 | OrderPaidV1 | OrderCancelledV1 {
  const base = { eventId: meta.eventId, version: 1 as const, occurredAt: meta.occurredAt.toISOString() };
  if (event instanceof OrderCreated) {
    return {
      ...base,
      type: 'orders.order-created',
      payload: { orderId: event.orderId, customerId: event.customerId },
    };
  }
  if (event instanceof OrderPlaced) {
    return {
      ...base,
      type: 'orders.order-placed',
      payload: { orderId: event.orderId, customerId: event.customerId },
    };
  }
  if (event instanceof OrderPaid) {
    return {
      ...base,
      type: 'orders.order-paid',
      payload: {
        orderId: event.orderId,
        customerId: event.customerId,
        totalCents: event.totalCents,
        currency: event.currency,
      },
    };
  }
  if (event instanceof OrderCancelled) {
    return {
      ...base,
      type: 'orders.order-cancelled',
      payload: { orderId: event.orderId, customerId: event.customerId },
    };
  }
  throw new Error(`No public contract for domain event: ${event.type}`);
}
