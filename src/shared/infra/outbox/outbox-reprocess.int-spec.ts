import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startOutboxDatabase } from '#test/helpers/outbox-database';
import { IdempotentConsumer } from '../../application/idempotent-consumer.js';
import { IntegrationEvent } from '../../application/integration-event.js';
import { EventPublisher } from '../../application/ports/event-publisher.js';
import { currentManager } from '../database/transaction-context.js';
import { TypeOrmTransactionManager } from '../database/typeorm-transaction-manager.js';
import { DEFAULT_OUTBOX_OPTIONS, OutboxRelay } from './outbox-relay.js';
import { TypeOrmOutbox } from './typeorm-outbox.js';
import { TypeOrmProcessedEvents } from './typeorm-processed-events.js';

// o UPDATE de docs/how-to/reprocessar-eventos-mortos.md, com o tipo e o período como parâmetros
const REPROCESS_SQL = `
  UPDATE shared.outbox
  SET "deadAt" = NULL, attempts = 0, "nextAttemptAt" = now()
  WHERE "deadAt" IS NOT NULL
    AND type = $1
    AND "deadAt" >= $2 AND "deadAt" < $3`;

/** Entrega ao handler e, enquanto `failing`, falha depois do efeito: a linha morre com o efeito já gravado. */
class FailsAfterEffectPublisher implements EventPublisher {
  failing = true;
  constructor(private readonly handle: (event: IntegrationEvent) => Promise<void>) {}

  async publish(event: IntegrationEvent) {
    await this.handle(event);
    if (this.failing) throw new Error('falha depois do efeito');
  }
}

describe('Reprocesso de eventos mortos (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ ds, stop } = await startOutboxDatabase());
    await ds.query(`CREATE TABLE IF NOT EXISTS shared.effects (event_id text, note text)`);
  });

  afterAll(() => stop?.());

  it('a linha reprocessada pelo SQL do how-to é entregue sem repetir o efeito', async () => {
    const idempotent = new IdempotentConsumer(
      new TypeOrmTransactionManager(ds),
      new TypeOrmProcessedEvents(ds),
      new FakeLogger(),
    );
    const publisher = new FailsAfterEffectPublisher((event) =>
      idempotent.handle('test.reprocess', event, async (e) => {
        await currentManager(ds).query(`INSERT INTO shared.effects VALUES ($1, 'ok')`, [e.eventId]);
      }),
    );
    let now = new Date('2026-01-01T12:00:00.000Z');
    const relay = new OutboxRelay(ds, publisher, { now: () => now }, new FakeLogger(), {
      ...DEFAULT_OUTBOX_OPTIONS,
      maxAttempts: 2,
    });
    const event: IntegrationEvent = {
      eventId: crypto.randomUUID(),
      type: 'test.reprocessed',
      version: 1,
      occurredAt: now.toISOString(),
      payload: {},
    };
    await new TypeOrmOutbox(ds).add('r1', [event]);
    const row = async () =>
      (await ds.query(`SELECT * FROM shared.outbox WHERE id = $1`, [event.eventId]))[0];
    const effects = async () =>
      Number(
        (
          await ds.query(`SELECT count(*) FROM shared.effects WHERE event_id = $1`, [event.eventId])
        )[0].count,
      );

    await relay.runOnce();
    now = new Date(now.getTime() + 60_000);
    await relay.runOnce();
    expect((await row()).deadAt).toEqual(now);
    expect(await effects()).toBe(1);

    const [, updated] = await ds.query<[unknown, number]>(REPROCESS_SQL, [
      event.type,
      new Date(now.getTime() - 60_000),
      new Date(now.getTime() + 60_000),
    ]);
    expect(updated).toBe(1);
    expect(await row()).toMatchObject({
      deadAt: null,
      attempts: 0,
      lastError: 'falha depois do efeito',
    });

    publisher.failing = false;
    // o `nextAttemptAt` é o `now()` do banco: o relógio do relay vai para depois dele, sem depender do relógio do host
    const [{ dbNow }] = await ds.query<{ dbNow: Date }[]>(`SELECT now() AS "dbNow"`);
    now = new Date(dbNow.getTime() + 1_000);
    expect(await relay.runOnce()).toBe(1);

    expect((await row()).publishedAt).toEqual(now);
    expect(await effects()).toBe(1);
  });
});
