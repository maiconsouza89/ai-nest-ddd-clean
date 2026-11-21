import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidQuantityError extends DomainError {
  readonly code = 'INVALID_QUANTITY';
  constructor() {
    super('Quantity must be a positive integer');
  }
}
