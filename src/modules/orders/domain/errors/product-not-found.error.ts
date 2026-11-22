import { DomainError } from '#shared/domain/domain-error';

export class ProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND';
  constructor(productId: string) {
    super(`Product not found: ${productId}`);
  }
}
