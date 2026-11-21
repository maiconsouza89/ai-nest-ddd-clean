import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakeEventPublisher } from '../../../../test/fakes/fake-event-publisher';
import { FakeLogger } from '../../../../test/fakes/fake-logger';
import { startOutboxDatabase } from '../../../../test/helpers/outbox-database';
import { IntegrationEvent } from '../../application/integration-event';
import { DEFAULT_OUTBOX_OPTIONS, OutboxOptions, OutboxRelay } from './outbox-relay';
import { TypeOrmOutbox } from './typeorm-outbox';

describe('OutboxRelay (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let outbox: TypeOrmOutbox;

  beforeAll(async () => {
    ({ ds, stop } = await startOutboxDatabase());
    outbox = new TypeOrmOutbox(ds);
  }, 120_000);

  afterAll(() => stop?.());

  // relógio controlável, para avançar o tempo sem esperar
  let now: Date;
  const clock = { now: () => now };
  beforeEach(async () => {
    now = new Date('2026-01-01T12:00:00.000Z');
    // cada teste começa com a outbox vazia
    await ds.query(`DELETE FROM shared.outbox`);
  });

  let logger: FakeLogger;
  beforeEach(() => {
    logger = new FakeLogger();
  });

  const relayWith = (publisher: FakeEventPublisher, options: Partial<OutboxOptions> = {}) =>
    new OutboxRelay(ds, publisher, clock, logger, { ...DEFAULT_OUTBOX_OPTIONS, ...options });

  async function add(aggregateId: string, type = 'orders.order-paid') {
    const event: IntegrationEvent = {
      eventId: crypto.randomUUID(),
      type,
      version: 1,
      occurredAt: now.toISOString(),
      payload: { orderId: aggregateId },
    };
    await outbox.add(aggregateId, [event]);
    return event;
  }

  const row = async (id: string) =>
    (await ds.query(`SELECT * FROM shared.outbox WHERE id = $1`, [id]))[0];

  it('entrega o evento ao handler do tipo e marca como publicado, uma vez só', async () => {
    const publisher = new FakeEventPublisher();
    const relay = relayWith(publisher);
    const event = await add('a1');

    expect(await relay.runOnce()).toBe(1);
    expect(await relay.runOnce()).toBe(0);

    // sem trace ativo na gravação, o metadata chega vazio
    expect(publisher.delivered).toEqual([{ ...event, metadata: {} }]);
    expect((await row(event.eventId)).publishedAt).toEqual(now);
  });

  it('falha no handler: conta a tentativa, espera o backoff e depois entrega', async () => {
    const publisher = new FakeEventPublisher();
    const relay = relayWith(publisher);
    const event = await add('a1');
    publisher.failing.add(event.eventId);

    await relay.runOnce();
    const failed = await row(event.eventId);
    expect(failed.attempts).toBe(1);
    expect(failed.publishedAt).toBeNull();
    expect(failed.lastError).toContain('falha ao entregar');
    expect(failed.nextAttemptAt).toEqual(new Date(now.getTime() + 1_000));
    expect(logger.entries.filter((e) => e.level === 'warn')).toEqual([
      expect.objectContaining({
        fields: expect.objectContaining({ eventId: event.eventId, attempt: 1 }),
      }),
    ]);

    // ainda dentro da espera: nada é tentado
    expect(await relay.runOnce()).toBe(0);

    publisher.failing.clear();
    now = new Date(now.getTime() + 1_000);
    expect(await relay.runOnce()).toBe(1);
    expect(publisher.delivered.map((e) => e.eventId)).toEqual([event.eventId]);
  });

  it('depois do limite de tentativas, o evento morre e não é mais buscado', async () => {
    const publisher = new FakeEventPublisher();
    const relay = relayWith(publisher, { maxAttempts: 2 });
    const event = await add('a1');
    publisher.failing.add(event.eventId);

    await relay.runOnce();
    now = new Date(now.getTime() + 60_000);
    await relay.runOnce();

    const dead = await row(event.eventId);
    expect(dead.attempts).toBe(2);
    expect(dead.deadAt).toEqual(now);
    expect(logger.entries.filter((e) => e.level === 'error')).toEqual([
      expect.objectContaining({
        fields: expect.objectContaining({ eventId: event.eventId, attempt: 2 }),
      }),
    ]);

    now = new Date(now.getTime() + 60_000);
    expect(await relay.runOnce()).toBe(0);
  });

  it('mantém a ordem do agregado: o seguinte espera o anterior; outros agregados seguem', async () => {
    const publisher = new FakeEventPublisher();
    const relay = relayWith(publisher);
    const first = await add('agg-x');
    const second = await add('agg-x');
    const other = await add('agg-y');
    publisher.failing.add(first.eventId);

    await relay.runOnce();
    expect(publisher.delivered.map((e) => e.eventId)).toEqual([other.eventId]);

    publisher.failing.clear();
    now = new Date(now.getTime() + 1_000);
    await relay.runOnce();
    expect(publisher.delivered.map((e) => e.eventId)).toEqual([other.eventId, first.eventId]);

    await relay.runOnce();
    expect(publisher.delivered.map((e) => e.eventId)).toEqual([
      other.eventId,
      first.eventId,
      second.eventId,
    ]);
  });

  it('um evento morto deixa de bloquear os seguintes do agregado', async () => {
    const publisher = new FakeEventPublisher();
    const relay = relayWith(publisher, { maxAttempts: 1 });
    const first = await add('agg-z');
    const second = await add('agg-z');
    publisher.failing.add(first.eventId);

    await relay.runOnce(); // first morre
    await relay.runOnce();

    expect(publisher.delivered.map((e) => e.eventId)).toEqual([second.eventId]);
  });

  it('dois workers em paralelo entregam cada evento uma única vez', async () => {
    const publisher = new FakeEventPublisher();
    const options = { batchSize: 5 };
    const workers = [relayWith(publisher, options), relayWith(publisher, options)];
    const events = await Promise.all(Array.from({ length: 40 }, (_, i) => add(`par-${i}`)));

    // cada worker repete até esvaziar a fila
    await Promise.all(
      workers.map(async (relay) => {
        while ((await relay.runOnce()) > 0);
      }),
    );

    const ids = publisher.delivered.map((e) => e.eventId);
    expect(ids).toHaveLength(events.length);
    expect(new Set(ids).size).toBe(events.length);
  });

  it('a limpeza apaga só o que foi publicado há mais que a retenção', async () => {
    const publisher = new FakeEventPublisher();
    const relay = relayWith(publisher, { retentionMs: 60_000 });
    const old = await add('c1');
    await relay.runOnce(); // publicado em `now`
    now = new Date(now.getTime() + 120_000);
    const recent = await add('c2');
    await relay.runOnce();
    const pending = await add('c3');
    publisher.failing.add(pending.eventId);
    await relay.runOnce();

    expect(await relay.cleanup()).toBe(1);

    expect(await row(old.eventId)).toBeUndefined();
    expect(await row(recent.eventId)).toBeDefined();
    expect(await row(pending.eventId)).toBeDefined();
  });
});
