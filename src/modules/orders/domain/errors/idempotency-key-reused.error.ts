import { DomainError } from '#shared/domain/domain-error';

export class IdempotencyKeyReusedError extends DomainError {
  readonly code = 'IDEMPOTENCY_KEY_REUSED';
  constructor() {
    super('Idempotency-Key was already used with a different request');
  }
}
