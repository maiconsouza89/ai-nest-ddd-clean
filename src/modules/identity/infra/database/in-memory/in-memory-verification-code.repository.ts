import {
  VerificationCode,
  VerificationCodeProps,
} from '../../../domain/entities/verification-code.entity.js';
import { VerificationCodeRepository } from '../../../domain/repositories/verification-code.repository.js';

export class InMemoryVerificationCodeRepository implements VerificationCodeRepository {
  private readonly rows: VerificationCodeProps[] = [];

  async add(code: VerificationCode) {
    for (const row of this.rows) {
      if (row.userId === code.userId) row.usedAt ??= code.createdAt;
    }
    this.rows.push(code.toProps());
  }

  async findLatestForUpdate(userId: string) {
    const row = this.rows.filter((r) => r.userId === userId).at(-1);
    return row ? VerificationCode.restore(row) : null;
  }

  async countIssuedSince(userId: string, since: Date) {
    return this.rows.filter((r) => r.userId === userId && r.createdAt >= since).length;
  }

  async save(code: VerificationCode) {
    const { id, attempts, usedAt } = code.toProps();
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, { attempts, usedAt });
  }

  /** Para os testes conferirem o estado gravado. */
  all() {
    return this.rows.map((r) => ({ ...r }));
  }
}
