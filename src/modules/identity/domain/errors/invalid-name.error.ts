import { DomainError } from '#shared/domain/domain-error';

export class InvalidNameError extends DomainError {
  readonly code = 'INVALID_NAME';
  constructor() {
    super('Name must have between 1 and 100 characters');
  }
}
