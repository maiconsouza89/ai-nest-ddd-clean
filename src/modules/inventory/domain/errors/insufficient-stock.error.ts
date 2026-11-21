import { DomainError } from '../../../../shared/domain/domain-error';

export class InsufficientStockError extends DomainError {
  readonly code = 'INSUFFICIENT_STOCK';
  constructor(readonly productId: string) {
    super(`Insufficient stock for product: ${productId}`);
  }
}
