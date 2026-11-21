import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { currentManager } from '../../../../../shared/infra/database/transaction-context';
import { IdempotencyClaim, IdempotencyStore } from '../../../application/ports/idempotency-store';
import { IdempotencyKeyReusedError } from '../../../domain/errors/idempotency-key-reused.error';

@Injectable()
export class TypeOrmIdempotencyStore implements IdempotencyStore {
  constructor(private readonly dataSource: DataSource) {}

  async claim({ key, actorId, fingerprint, expiresAt, now }: IdempotencyClaim) {
    const manager = currentManager(this.dataSource);
    // Insere, ou reaproveita a linha só se já expirou. Com duas requisições simultâneas, a segunda espera
    // a primeira confirmar no índice único e então não insere nada (linha ainda válida).
    const claimed: unknown[] = await manager.query(
      `INSERT INTO "orders"."idempotency_keys" ("actorId", "key", "fingerprint", "expiresAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("actorId", "key") DO UPDATE
         SET "fingerprint" = EXCLUDED."fingerprint", "expiresAt" = EXCLUDED."expiresAt"
         WHERE "orders"."idempotency_keys"."expiresAt" <= $5
       RETURNING 1`,
      [actorId, key, fingerprint, expiresAt, now],
    );
    if (claimed.length > 0) return 'first';

    const [existing] = await manager.query<{ fingerprint: string }[]>(
      `SELECT "fingerprint" FROM "orders"."idempotency_keys" WHERE "actorId" = $1 AND "key" = $2`,
      [actorId, key],
    );
    if (existing.fingerprint !== fingerprint) throw new IdempotencyKeyReusedError();
    return 'replay';
  }
}
