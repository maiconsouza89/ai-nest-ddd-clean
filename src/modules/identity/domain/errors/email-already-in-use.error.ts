import { DomainError } from '../../../../shared/domain/domain-error';

export class EmailAlreadyInUseError extends DomainError {
  readonly code = 'EMAIL_ALREADY_IN_USE';
  constructor() {
    super('Email is already in use');
  }
}
