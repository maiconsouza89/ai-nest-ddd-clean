import { describe, it, expect } from 'vitest';
import { postgresOptions } from './postgres-options.js';

const ENV = {
  DATABASE_URL: 'postgres://u:p@db:5432/app?sslmode=verify-full',
  DATABASE_POOL_MAX: 20,
  DATABASE_CONNECT_TIMEOUT_MS: 3000,
  DATABASE_STATEMENT_TIMEOUT_MS: 15_000,
  DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: 45_000,
};

describe('postgresOptions', () => {
  it('leva as variáveis para o pool, a conexão e os parâmetros de sessão', () => {
    expect(postgresOptions(ENV)).toEqual({
      type: 'postgres',
      url: ENV.DATABASE_URL,
      poolSize: 20,
      connectTimeoutMS: 3000,
      extra: { statement_timeout: 15_000, idle_in_transaction_session_timeout: 45_000 },
    });
  });

  it('nas migrations, mantém o pool e a conexão e tira os dois timeouts de query', () => {
    expect(postgresOptions(ENV, { migrations: true })).toEqual({
      type: 'postgres',
      url: ENV.DATABASE_URL,
      poolSize: 20,
      connectTimeoutMS: 3000,
      extra: {},
    });
  });

  it('deixa fora do extra o timeout em 0', () => {
    expect(postgresOptions({ ...ENV, DATABASE_STATEMENT_TIMEOUT_MS: 0 }).extra).toEqual({
      idle_in_transaction_session_timeout: 45_000,
    });
    expect(postgresOptions({ ...ENV, DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: 0 }).extra).toEqual({
      statement_timeout: 15_000,
    });
  });
});
