import { DomainError } from '#shared/domain/domain-error';

export class EmailNotVerifiedError extends DomainError {
  readonly code = 'EMAIL_NOT_VERIFIED';
  constructor() {
    super('Email is not verified');
  }
}
