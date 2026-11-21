import { IdempotencyClaim, IdempotencyStore } from '../../src/modules/orders/application/ports/idempotency-store';
import { IdempotencyKeyReusedError } from '../../src/modules/orders/domain/errors/idempotency-key-reused.error';

export class FakeIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<string, { fingerprint: string; expiresAt: Date }>();

  async claim({ key, actorId, fingerprint, expiresAt, now }: IdempotencyClaim) {
    const id = `${actorId}:${key}`;
    const row = this.rows.get(id);
    if (!row || row.expiresAt <= now) {
      this.rows.set(id, { fingerprint, expiresAt });
      return 'first' as const;
    }
    if (row.fingerprint !== fingerprint) throw new IdempotencyKeyReusedError();
    return 'replay' as const;
  }
}
