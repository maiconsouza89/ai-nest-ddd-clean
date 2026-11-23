import { Clock } from '#shared/application/ports/clock';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.js';

/**
 * Apaga os refresh tokens vencidos. Um token vencido já é recusado, e a família dele já não pode
 * mais detectar reuso por ele, então a linha só ocupa espaço. Cada renovação grava uma linha nova,
 * por isso a limpeza segue o prazo de cada token, e não o da família.
 */
export class PurgeExpiredRefreshTokensUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly clock: Clock,
    // em lotes: um DELETE só, depois de um dia de renovações, seguraria uma transação longa
    private readonly batchSize = 1000,
  ) {}

  async execute() {
    const now = this.clock.now();
    let total = 0;
    let deleted: number;
    do {
      deleted = await this.refreshTokens.deleteExpired(now, this.batchSize);
      total += deleted;
    } while (deleted === this.batchSize);
    return total;
  }
}
