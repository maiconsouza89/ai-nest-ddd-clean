import { DomainError } from './domain-error';

export class ConcurrencyError extends DomainError {
  readonly code = 'CONCURRENCY_CONFLICT';
  constructor() {
    super('The resource was modified by another request. Reload and try again.');
  }
}
