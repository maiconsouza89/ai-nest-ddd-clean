import { Clock } from '#shared/application/ports/clock';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error.js';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.js';
import { OpaqueTokenGenerator } from '../ports/opaque-token-generator.js';
import { SessionIssuer } from '../session-issuer.js';

/**
 * Troca um refresh token por um par novo. Cada token vale uma vez: se um já usado aparecer de
 * novo, duas partes têm o mesmo token (o cliente e quem o roubou), e a família inteira é revogada.
 */
export class RefreshSessionUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly secrets: OpaqueTokenGenerator,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
  ) {}

  async execute(refreshToken: string) {
    const now = this.clock.now();
    const token = await this.refreshTokens.findByHash(this.secrets.hash(refreshToken));
    if (!token || token.isDeadAt(now)) throw new InvalidRefreshTokenError();

    // Marcar o uso e gravar o sucessor na mesma transação: numa renovação concorrente com o mesmo
    // token, o markUsed da segunda só responde depois que a primeira termina, e a revogação dela
    // já pega o sucessor.
    const session = await this.tx.run(async () => {
      // markUsed falso também cobre família revogada ou token vencido depois da leitura; revogar
      // de novo, nesses casos, não muda nada
      const reused = token.wasUsed || !(await this.refreshTokens.markUsed(token.id, now));
      if (reused) {
        await this.refreshTokens.revokeFamily(token.familyId, now);
        return null;
      }
      return this.sessions.rotate(token);
    });
    // fora da transação: lançar dentro dela desfaria a revogação
    if (!session) throw new InvalidRefreshTokenError();
    return session;
  }
}
