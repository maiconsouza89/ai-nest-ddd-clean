import { DomainError } from '#shared/domain/domain-error';

export class OrderAlreadyPaidError extends DomainError {
  readonly code = 'ORDER_ALREADY_PAID';
  constructor() {
    super('Order is already paid');
  }
}
