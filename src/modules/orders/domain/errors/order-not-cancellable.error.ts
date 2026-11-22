import { DomainError } from '#shared/domain/domain-error';

export class OrderNotCancellableError extends DomainError {
  readonly code = 'ORDER_NOT_CANCELLABLE';
  constructor() {
    super('Only draft or placed orders can be cancelled');
  }
}
