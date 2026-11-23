import { DomainError } from '#shared/domain/domain-error';

// Mesma resposta para token desconhecido, vencido, revogado ou reusado: não revela qual foi.
export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';
  constructor() {
    super('Invalid refresh token');
  }
}
