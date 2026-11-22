import { DomainError } from '#shared/domain/domain-error';

export class OrderNotPayableError extends DomainError {
  readonly code = 'ORDER_NOT_PAYABLE';
  constructor() {
    super('Order must be placed before payment');
  }
}
