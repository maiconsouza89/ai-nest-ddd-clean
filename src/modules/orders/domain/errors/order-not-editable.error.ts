import { DomainError } from '#shared/domain/domain-error';

export class OrderNotEditableError extends DomainError {
  readonly code = 'ORDER_NOT_EDITABLE';
  constructor() {
    super('Order can no longer be edited');
  }
}
