import { DomainError } from '../../../../shared/domain/domain-error';

export class InsufficientStockError extends DomainError {
  readonly code = 'INSUFFICIENT_STOCK';
  constructor(productId: string) {
    super(`Insufficient stock for product: ${productId}`);
  }
}
