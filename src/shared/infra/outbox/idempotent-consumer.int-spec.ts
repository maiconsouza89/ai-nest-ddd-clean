import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startOutboxDatabase } from '#test/helpers/outbox-database';
import { IdempotentConsumer } from '../../application/idempotent-consumer.js';
import { IntegrationEvent } from '../../application/integration-event.js';
import { TypeOrmTransactionManager } from '../database/typeorm-transaction-manager.js';
import { currentManager } from '../database/transaction-context.js';
import { TypeOrmProcessedEvents } from './typeorm-processed-events.js';

describe('IdempotentConsumer (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let consumer: IdempotentConsumer;

  beforeAll(async () => {
    ({ ds, stop } = await startOutboxDatabase());
    consumer = new IdempotentConsumer(
      new TypeOrmTransactionManager(ds),
      new TypeOrmProcessedEvents(ds),
      new FakeLogger(),
    );
    await ds.query(`CREATE TABLE IF NOT EXISTS shared.effects (event_id text, note text)`);
  }, 120_000);

  afterAll(() => stop?.());

  beforeEach(async () => {
    await ds.query(`DELETE FROM shared.processed_events`);
    await ds.query(`DELETE FROM shared.effects`);
  });

  const event = (): IntegrationEvent => ({
    eventId: crypto.randomUUID(),
    type: 'test.something-happened',
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: {},
  });

  // efeito gravado pelo manager da transação ativa, como um caso de uso faria
  const effect = (e: IntegrationEvent) =>
    currentManager(ds)
      .query(`INSERT INTO shared.effects VALUES ($1, 'ok')`, [e.eventId])
      .then(() => undefined);
  const effectCount = async (e: IntegrationEvent) =>
    Number(
      (await ds.query(`SELECT count(*) FROM shared.effects WHERE event_id = $1`, [e.eventId]))[0]
        .count,
    );

  it('entregar o mesmo evento duas vezes produz o efeito uma vez só', async () => {
    const e = event();

    await consumer.handle('inventory', e, effect);
    await consumer.handle('inventory', e, effect);

    expect(await effectCount(e)).toBe(1);
  });

  it('duas entregas simultâneas também produzem o efeito uma vez só (a constraint resolve a corrida)', async () => {
    const e = event();

    // as duas passam pelo tryMark ao mesmo tempo; só uma consegue inserir
    await Promise.all(Array.from({ length: 5 }, () => consumer.handle('inventory', e, effect)));

    expect(await effectCount(e)).toBe(1);
  });

  it('cada consumidor trata o mesmo evento uma vez', async () => {
    const e = event();

    await consumer.handle('inventory', e, effect);
    await consumer.handle('billing', e, effect);
    await consumer.handle('billing', e, effect);

    expect(await effectCount(e)).toBe(2);
  });

  it('se o efeito falha, a marca desfaz junto e o retry reprocessa', async () => {
    const e = event();

    await expect(
      consumer.handle('inventory', e, async (ev) => {
        await effect(ev);
        throw new Error('falhou depois de gravar');
      }),
    ).rejects.toThrow('falhou depois de gravar');
    expect(await effectCount(e)).toBe(0);

    await consumer.handle('inventory', e, effect);
    expect(await effectCount(e)).toBe(1);
  });

  it('a falha do handler se propaga e a reentrega funciona', async () => {
    let fail = true;
    const deliver = (e: IntegrationEvent) =>
      consumer.handle('inventory', e, async (ev) => {
        await effect(ev);
        if (fail) throw new Error('boom');
      });
    const e = event();

    await expect(deliver(e)).rejects.toThrow('boom');
    fail = false;
    await deliver(e);
    await deliver(e);

    expect(await effectCount(e)).toBe(1);
  });
});
