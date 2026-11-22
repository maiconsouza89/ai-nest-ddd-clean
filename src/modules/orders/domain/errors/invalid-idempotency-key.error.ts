import { DomainError } from '#shared/domain/domain-error';

export class InvalidIdempotencyKeyError extends DomainError {
  readonly code = 'INVALID_IDEMPOTENCY_KEY';
  constructor() {
    super('Idempotency-Key must have between 1 and 255 characters');
  }
}
