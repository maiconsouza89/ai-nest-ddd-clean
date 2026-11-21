import { DomainEvent } from '../../../../shared/domain/domain-event';
import { OrderPaidV1 } from '../../contracts/events/order-paid.event';
import { OrderPaid } from '../../domain/events/order-paid.event';

type Meta = { eventId: string; occurredAt: Date };

/** Converte o evento de domínio no contrato público. Eventos sem contrato falham alto. */
export function toIntegrationEvent(event: DomainEvent, meta: Meta): OrderPaidV1 {
  if (event instanceof OrderPaid) {
    return {
      eventId: meta.eventId,
      type: 'orders.order-paid',
      version: 1,
      occurredAt: meta.occurredAt.toISOString(),
      payload: {
        orderId: event.orderId,
        customerId: event.customerId,
        totalCents: event.totalCents,
        currency: event.currency,
      },
    };
  }
  throw new Error(`No public contract for domain event: ${event.type}`);
}
