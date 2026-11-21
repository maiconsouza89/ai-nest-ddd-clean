import { DomainError } from '../../../../shared/domain/domain-error';

export class EmptyOrderError extends DomainError {
  readonly code = 'EMPTY_ORDER';
  constructor() {
    super('Order has no items');
  }
}
