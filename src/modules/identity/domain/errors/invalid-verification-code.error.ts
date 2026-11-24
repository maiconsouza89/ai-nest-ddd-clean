import { DomainError } from '#shared/domain/domain-error';

// Mesma resposta para código errado, vencido, usado, esgotado ou e-mail desconhecido: não revela qual foi.
export class InvalidVerificationCodeError extends DomainError {
  readonly code = 'INVALID_VERIFICATION_CODE';
  constructor() {
    super('Invalid verification code');
  }
}
