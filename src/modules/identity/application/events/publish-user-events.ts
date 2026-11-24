import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Outbox } from '#shared/application/ports/outbox';
import { User } from '../../domain/entities/user.entity.js';
import { toIntegrationEvent } from './to-integration-event.js';

/** Grava na outbox os eventos que o usuário anotou. Chamar dentro da transação do `save`. */
export async function publishUserEvents(
  user: User,
  { outbox, ids, clock }: { outbox: Outbox; ids: IdGenerator; clock: Clock },
) {
  const occurredAt = clock.now();
  const events = user
    .pullDomainEvents()
    .map((e) => toIntegrationEvent(e, { eventId: ids.next(), occurredAt }));
  await outbox.add(user.id, events);
}
