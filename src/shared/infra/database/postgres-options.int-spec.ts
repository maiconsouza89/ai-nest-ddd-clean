import { describe, it, expect, inject } from 'vitest';
import 'reflect-metadata';
import { setTimeout as sleep } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { databaseUrl, withDataSource } from '#test/helpers/database';
import { postgresOptions } from './postgres-options.js';

// Limites curtos para o teste caber em poucos segundos; o banco `postgres` basta, sem schema.
const LIMITS = {
  DATABASE_POOL_MAX: 2,
  DATABASE_CONNECT_TIMEOUT_MS: 200,
  DATABASE_STATEMENT_TIMEOUT_MS: 200,
  DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: 200,
};

const withLimits = (overrides: Partial<typeof LIMITS>, run: (ds: DataSource) => Promise<void>) =>
  withDataSource(
    postgresOptions({
      DATABASE_URL: databaseUrl(inject('postgresUrl'), 'postgres'),
      ...LIMITS,
      ...overrides,
    }),
    run,
  );

describe('postgresOptions (integração)', () => {
  it('o servidor cancela a query acima do statement_timeout, e a conexão volta ao pool', async () => {
    await withLimits({ DATABASE_POOL_MAX: 1 }, async (ds) => {
      await expect(ds.query('SELECT pg_sleep(1)')).rejects.toMatchObject({ code: '57014' });
      // pool de 1: o SELECT só responde se a conexão da query cancelada voltou a ele
      expect(await ds.query('SELECT 1 AS ok')).toEqual([{ ok: 1 }]);
    });
  });

  it('o servidor encerra a sessão com transação ociosa além do limite, e o DataSource segue atendendo', async () => {
    await withLimits({}, async (ds) => {
      const qr = ds.createQueryRunner();
      try {
        await qr.startTransaction();
        await sleep(400);
        await expect(qr.query('SELECT 1')).rejects.toThrow();
      } finally {
        await qr.release();
      }
      expect(await ds.query('SELECT 1 AS ok')).toEqual([{ ok: 1 }]);
    });
  });

  it('com o pool cheio, o pedido de conexão falha dentro do connectTimeoutMS', async () => {
    await withLimits({ DATABASE_POOL_MAX: 1 }, async (ds) => {
      const qr = ds.createQueryRunner();
      await qr.connect();
      try {
        const started = performance.now();
        await expect(ds.query('SELECT 1')).rejects.toThrow(
          'timeout exceeded when trying to connect',
        );
        expect(performance.now() - started).toBeLessThan(2 * LIMITS.DATABASE_CONNECT_TIMEOUT_MS);
      } finally {
        await qr.release();
      }
    });
  });
});
