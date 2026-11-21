import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { Outbox } from '../../../../shared/application/ports/outbox';
import { Order } from '../../domain/entities/order.entity';
import { toIntegrationEvent } from './to-integration-event';

/** Grava na outbox os eventos que o pedido anotou. Chamar dentro da transação do `save`. */
export async function publishOrderEvents(
  order: Order,
  { outbox, ids, clock }: { outbox: Outbox; ids: IdGenerator; clock: Clock },
) {
  const occurredAt = clock.now();
  const events = order
    .pullDomainEvents()
    .map((e) => toIntegrationEvent(e, { eventId: ids.next(), occurredAt }));
  await outbox.add(order.id, events);
}
