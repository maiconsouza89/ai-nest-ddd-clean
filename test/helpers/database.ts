import { randomUUID } from 'node:crypto';
import { inject } from 'vitest';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Um conjunto de migrations com as entidades que os testes usam sobre ele. O `globalSetup` do projeto
 * `int` (test/global-setup/int.ts) monta um banco `tpl_<template>` por conjunto, e cada arquivo de teste
 * ganha uma cópia dele. Um conjunto por módulo: a migration de um módulo não pode depender do schema de outro.
 */
export type ModuleDatabase = {
  template: string;
  entities: NonNullable<DataSourceOptions['entities']>;
  migrations: NonNullable<DataSourceOptions['migrations']>;
  migrationsTableName: string;
};

export const templateName = (template: string) => `tpl_${template}`;

/** A URL do Postgres compartilhado apontando para o banco `database`. */
export function databaseUrl(serverUrl: string, database: string) {
  const url = new URL(serverUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Roda comandos no banco `postgres`, que não é template de nada, por isso CREATE e DROP DATABASE vão por ele. */
export async function withAdmin(serverUrl: string, run: (ds: DataSource) => Promise<unknown>) {
  const admin = new DataSource({
    type: 'postgres',
    url: databaseUrl(serverUrl, 'postgres'),
    poolSize: 1,
  });
  await admin.initialize();
  try {
    await run(admin);
  } finally {
    await admin.destroy();
  }
}

/**
 * Um banco só deste arquivo, clonado do template do módulo (já migrado) no Postgres compartilhado.
 * O `stop` fecha a conexão e apaga o banco; o que sobrar some com o container no fim da execução.
 */
export async function startDatabase({ template, entities }: ModuleDatabase) {
  const serverUrl = inject('postgresUrl');
  const name = `${template}_${process.env.VITEST_POOL_ID ?? 0}_${randomUUID().slice(0, 8)}`;
  await withAdmin(serverUrl, (admin) =>
    admin.query(`CREATE DATABASE "${name}" TEMPLATE "${templateName(template)}"`),
  );
  const ds = new DataSource({ type: 'postgres', url: databaseUrl(serverUrl, name), entities });
  await ds.initialize();
  return {
    ds,
    stop: async () => {
      await ds.destroy();
      await withAdmin(serverUrl, (admin) => admin.query(`DROP DATABASE "${name}" WITH (FORCE)`));
    },
  };
}
