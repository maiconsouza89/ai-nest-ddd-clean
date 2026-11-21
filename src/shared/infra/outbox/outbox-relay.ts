import { DataSource, EntityManager } from 'typeorm';
import { EventMetadata, IntegrationEvent } from '../../application/integration-event';
import { Clock } from '../../application/ports/clock';
import { EventPublisher } from '../../application/ports/event-publisher';
import { Logger } from '../../application/ports/logger';
import { runInEventTrace } from '../observability/trace-context';

export type OutboxOptions = {
  batchSize: number;
  /** Depois de tantas falhas, o evento vai para a fila de mortos (`deadAt`). */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Quanto tempo os eventos já publicados ficam antes da limpeza. */
  retentionMs: number;
};

export const DEFAULT_OUTBOX_OPTIONS: OutboxOptions = {
  batchSize: 50,
  maxAttempts: 8,
  baseDelayMs: 1_000,
  maxDelayMs: 5 * 60_000,
  retentionMs: 7 * 24 * 60 * 60_000,
};

/** Espera após a n-ésima falha: base, 2x, 4x... limitada a `maxDelayMs`. */
export function backoffDelayMs(failures: number, { baseDelayMs, maxDelayMs }: OutboxOptions) {
  return Math.min(baseDelayMs * 2 ** (failures - 1), maxDelayMs);
}

type PendingRow = {
  id: string;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  metadata: EventMetadata;
  occurredAt: Date;
  attempts: number;
};

// Pendentes e vencidos, sem nenhum evento anterior do mesmo agregado ainda por entregar
// (nem preso em backoff): garante a ordem por agregado. `SKIP LOCKED` faz dois workers
// nunca pegarem a mesma linha.
const CLAIM_SQL = `
  SELECT o.id, o.type, o.version, o.payload, o.metadata, o."occurredAt", o.attempts
  FROM shared.outbox o
  WHERE o."publishedAt" IS NULL AND o."deadAt" IS NULL AND o."nextAttemptAt" <= $1
    AND NOT EXISTS (
      SELECT 1 FROM shared.outbox earlier
      WHERE earlier."aggregateId" = o."aggregateId"
        AND earlier.seq < o.seq
        AND earlier."publishedAt" IS NULL AND earlier."deadAt" IS NULL
    )
  ORDER BY o.seq
  LIMIT $2
  FOR UPDATE OF o SKIP LOCKED`;

export class OutboxRelay {
  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: EventPublisher,
    private readonly clock: Clock,
    private readonly logger: Logger,
    readonly options: OutboxOptions = DEFAULT_OUTBOX_OPTIONS,
  ) {}

  /** Entrega um lote. Devolve quantos eventos foram tentados. */
  async runOnce(): Promise<number> {
    const now = this.clock.now();
    // as linhas ficam travadas até o commit; esta transação não é propagada aos handlers
    return this.dataSource.transaction(async (em) => {
      const rows: PendingRow[] = await em.query(CLAIM_SQL, [now, this.options.batchSize]);
      for (const row of rows) {
        try {
          await runInEventTrace(
            `outbox.publish ${row.type}`,
            row.metadata.traceparent,
            { 'messaging.message.id': row.id, 'messaging.operation': 'process' },
            () => {
              // dentro do span do evento: o log leva o trace da requisição que o originou
              this.logger.info({ eventId: row.id, type: row.type, attempt: row.attempts + 1 }, 'delivering event');
              return this.publisher.publish(toEvent(row));
            },
          );
          await em.query(`UPDATE shared.outbox SET "publishedAt" = $2 WHERE id = $1`, [row.id, now]);
        } catch (error) {
          await this.recordFailure(em, row, error, now);
        }
      }
      return rows.length;
    });
  }

  /** Apaga os eventos publicados há mais que o tempo de retenção. */
  async cleanup(): Promise<number> {
    const limit = new Date(this.clock.now().getTime() - this.options.retentionMs);
    const [, deleted] = await this.dataSource.query(
      `DELETE FROM shared.outbox WHERE "publishedAt" < $1`,
      [limit],
    );
    return deleted as number;
  }

  private async recordFailure(em: EntityManager, row: PendingRow, error: unknown, now: Date) {
    const failures = row.attempts + 1;
    const dead = failures >= this.options.maxAttempts;
    const nextAttemptAt = new Date(now.getTime() + backoffDelayMs(failures, this.options));
    const message = error instanceof Error ? error.message : String(error);
    const fields = { eventId: row.id, type: row.type, attempt: failures, error: message };
    if (dead) this.logger.error(fields, 'event dead-lettered after max attempts');
    else this.logger.warn({ ...fields, nextAttemptAt }, 'event delivery failed, will retry');
    await em.query(
      `UPDATE shared.outbox
       SET attempts = $2, "lastError" = $3, "nextAttemptAt" = $4, "deadAt" = $5
       WHERE id = $1`,
      [row.id, failures, message, nextAttemptAt, dead ? now : null],
    );
  }
}

function toEvent(row: PendingRow): IntegrationEvent {
  return {
    eventId: row.id,
    type: row.type,
    version: row.version,
    occurredAt: row.occurredAt.toISOString(),
    payload: row.payload,
    metadata: row.metadata,
  };
}
