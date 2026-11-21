import { DomainError } from '../../../../shared/domain/domain-error';

export class NotOrderOwnerError extends DomainError {
  readonly code = 'NOT_ORDER_OWNER';
  constructor() {
    super('Actor does not own this order');
  }
}
