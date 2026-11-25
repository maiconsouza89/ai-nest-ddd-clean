import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { startOrdersDatabase } from '#test/helpers/orders-database';
import { TypeOrmTransactionManager } from '#shared/infra/database/typeorm-transaction-manager';
import { IdempotencyKeyReusedError } from '../../../domain/errors/idempotency-key-reused.error.js';
import { TypeOrmIdempotencyStore } from './typeorm-idempotency.store.js';

describe('TypeOrmIdempotencyStore (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let store: TypeOrmIdempotencyStore;
  let tx: TypeOrmTransactionManager;
  const actorId = '00000000-0000-4000-8000-000000000001';
  const now = new Date('2026-01-01T12:00:00Z');
  const later = new Date('2026-01-02T12:00:00Z');
  const claim = (key: string, fingerprint = 'pay:o1', at = now, expiresAt = later) =>
    tx.run(() => store.claim({ key, actorId, fingerprint, now: at, expiresAt }));

  beforeAll(async () => {
    ({ ds, stop } = await startOrdersDatabase());
    store = new TypeOrmIdempotencyStore(ds);
    tx = new TypeOrmTransactionManager(ds);
  });

  afterAll(() => stop?.());

  it('primeira vez reserva; repetir devolve replay', async () => {
    expect(await claim('a')).toBe('first');
    expect(await claim('a')).toBe('replay');
  });

  it('mesma chave com outro fingerprint é rejeitada', async () => {
    await claim('b');
    await expect(claim('b', 'pay:outro')).rejects.toThrow(IdempotencyKeyReusedError);
  });

  it('chave expirada pode ser reservada de novo, até com outro fingerprint', async () => {
    await claim('c');
    const afterExpiry = new Date('2026-01-03T00:00:00Z');
    expect(await claim('c', 'pay:outro', afterExpiry, new Date('2026-01-04T00:00:00Z'))).toBe(
      'first',
    );
  });

  it('transação desfeita não queima a chave', async () => {
    await expect(
      tx.run(async () => {
        await store.claim({ key: 'd', actorId, fingerprint: 'pay:o1', now, expiresAt: later });
        throw new Error('falha depois da reserva');
      }),
    ).rejects.toThrow('falha depois');
    expect(await claim('d')).toBe('first');
  });

  it('duas requisições simultâneas: uma reserva, a outra vira replay', async () => {
    const results = await Promise.all([claim('e'), claim('e')]);
    expect(results.sort()).toEqual(['first', 'replay']);
  });
});
