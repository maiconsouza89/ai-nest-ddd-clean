import { Clock } from '#shared/application/ports/clock';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.js';
import { OpaqueTokenGenerator } from '../ports/opaque-token-generator.js';

/**
 * Encerra a sessão revogando a família do refresh token. Token desconhecido não é erro: a resposta
 * é sempre a mesma, para não revelar quais tokens existem.
 */
export class LogoutUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly secrets: OpaqueTokenGenerator,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
  ) {}

  async execute(refreshToken: string) {
    const token = await this.refreshTokens.findByHash(this.secrets.hash(refreshToken));
    // numa transação: a revogação trava a família, e uma renovação em andamento termina antes
    if (token) {
      await this.tx.run(() => this.refreshTokens.revokeFamily(token.familyId, this.clock.now()));
    }
  }
}
