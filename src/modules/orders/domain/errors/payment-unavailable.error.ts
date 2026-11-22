import { DomainError } from '#shared/domain/domain-error';

export class PaymentUnavailableError extends DomainError {
  readonly code = 'PAYMENT_UNAVAILABLE';
  constructor() {
    super('Payment provider is unavailable, try again later');
  }
}
