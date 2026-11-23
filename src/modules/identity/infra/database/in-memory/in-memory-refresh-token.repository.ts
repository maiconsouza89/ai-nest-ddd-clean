import { RefreshToken, RefreshTokenProps } from '../../../domain/entities/refresh-token.entity.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly rows = new Map<string, RefreshTokenProps>();

  async add(token: RefreshToken) {
    this.rows.set(token.id, token.toProps());
  }

  async findByHash(tokenHash: string) {
    const row = [...this.rows.values()].find((r) => r.tokenHash === tokenHash);
    return row ? RefreshToken.restore(row) : null;
  }

  async markUsed(id: string, at: Date) {
    const row = this.rows.get(id);
    if (!row || row.usedAt || row.revokedAt || row.expiresAt <= at) return false;
    row.usedAt = at;
    return true;
  }

  async revokeFamily(familyId: string, at: Date) {
    for (const row of this.rows.values()) {
      if (row.familyId === familyId) row.revokedAt ??= at;
    }
  }

  async deleteExpired(now: Date, limit: number) {
    const expired = [...this.rows.values()].filter((r) => r.expiresAt < now).slice(0, limit);
    for (const row of expired) this.rows.delete(row.id);
    return expired.length;
  }

  /** Para os testes conferirem o estado gravado. */
  all() {
    return [...this.rows.values()];
  }
}
