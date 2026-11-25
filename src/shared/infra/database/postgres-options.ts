import type { DataSourceOptions } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation.js';

/** As variáveis que a `postgresOptions` lê; o `DatabaseModule` as busca no `ConfigService` por esta lista. */
export const POSTGRES_ENV_KEYS = [
  'DATABASE_URL',
  'DATABASE_POOL_MAX',
  'DATABASE_CONNECT_TIMEOUT_MS',
  'DATABASE_STATEMENT_TIMEOUT_MS',
  'DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS',
] as const satisfies readonly (keyof EnvironmentVariables)[];

export type PostgresEnv = Pick<EnvironmentVariables, (typeof POSTGRES_ENV_KEYS)[number]>;

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/**
 * A conexão com o Postgres de todo ponto que a abre: a app (`DatabaseModule`) e os DataSources da CLI.
 * O SSL fica só na `DATABASE_URL` (`sslmode`, `sslrootcert`): no `pg`, o que vem da URL vence o config.
 *
 * Os timeouts de query vão no `extra`, que o `pg` manda como parâmetros de conexão e o servidor aplica.
 * Com `migrations: true` eles ficam de fora: um `CREATE INDEX` ou um backfill do deploy não pode ser
 * cancelado. Um timeout em 0 também fica de fora, e vale o do servidor ou do role (ex.: atrás do PgBouncer).
 */
export function postgresOptions(env: PostgresEnv, { migrations = false } = {}) {
  const statement = env.DATABASE_STATEMENT_TIMEOUT_MS;
  const idle = env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS;
  const extra = migrations
    ? {}
    : {
        ...(statement > 0 && { statement_timeout: statement }),
        ...(idle > 0 && { idle_in_transaction_session_timeout: idle }),
      };
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    poolSize: env.DATABASE_POOL_MAX,
    connectTimeoutMS: env.DATABASE_CONNECT_TIMEOUT_MS,
    extra,
  } satisfies PostgresOptions;
}
