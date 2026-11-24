import { DomainEvent } from '#shared/domain/domain-event';
import { EmailVerifiedV1 } from '../../contracts/events/email-verified.event.js';
import { EmailVerified } from '../../domain/events/email-verified.event.js';

type Meta = { eventId: string; occurredAt: Date };

/** Converte o evento de domínio no contrato público. Eventos sem contrato falham alto. */
export function toIntegrationEvent(event: DomainEvent, meta: Meta): EmailVerifiedV1 {
  if (event instanceof EmailVerified) {
    return {
      eventId: meta.eventId,
      type: 'identity.email-verified',
      version: 1,
      occurredAt: meta.occurredAt.toISOString(),
      payload: { userId: event.userId, email: event.email, name: event.name },
    };
  }
  throw new Error(`No public contract for domain event: ${event.type}`);
}
