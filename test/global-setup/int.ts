/// <reference types="vite/client" />
import 'reflect-metadata';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { TestProject } from 'vitest/node';
import { databaseUrl, ModuleDatabase, templateName, withAdmin } from '../helpers/database.js';
import { startRedisContainer } from '../helpers/redis.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Postgres compartilhado, sem banco no caminho (test/helpers/database.ts escolhe o banco). */
    postgresUrl: string;
    /** Redis compartilhado, sem o índice do banco lógico (test/helpers/redis.ts escolhe o do worker). */
    redisUrl: string;
  }
}

// Cada `test/helpers/<módulo>-database.ts` exporta o seu conjunto. Por glob, para um módulo novo do
// `plop module` ganhar o template sem registro aqui, e um módulo removido não deixar import quebrado.
const helpers = import.meta.glob<Record<string, unknown>>('../helpers/*-database.ts', {
  eager: true,
});

const isModuleDatabase = (value: unknown): value is ModuleDatabase =>
  typeof value === 'object' && value !== null && 'template' in value && 'migrations' in value;

const moduleDatabases = () =>
  Object.values(helpers).flatMap((exports) => Object.values(exports).filter(isModuleDatabase));

// Sem durabilidade: o banco é descartado no fim, e o fsync de cada commit é o que mais pesa na suíte.
const postgresContainer = () =>
  new PostgreSqlContainer('postgres:19')
    .withCommand([
      'postgres',
      ...[
        'fsync=off',
        'synchronous_commit=off',
        'full_page_writes=off',
        'max_connections=200',
      ].flatMap((setting) => ['-c', setting]),
    ])
    // a imagem 18+ guarda o PGDATA embaixo de /var/lib/postgresql
    .withTmpFs({ '/var/lib/postgresql': 'rw' });

// Um template por conjunto de migrations; o DataSource fecha antes da cópia, que exige o template sem conexões.
async function createTemplate(serverUrl: string, db: ModuleDatabase) {
  const name = templateName(db.template);
  await withAdmin(serverUrl, (admin) => admin.query(`CREATE DATABASE "${name}"`));
  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl(serverUrl, name),
    migrations: db.migrations,
    migrationsTableName: db.migrationsTableName,
  });
  await ds.initialize();
  try {
    await ds.runMigrations();
  } finally {
    await ds.destroy();
  }
}

/** Um Postgres e um Redis por execução do projeto `int`, com um template migrado por conjunto de migrations. */
export default async function setup({ provide }: TestProject) {
  const [postgres, redis] = await Promise.all([postgresContainer().start(), startRedisContainer()]);
  const stop = () => Promise.all([postgres.stop(), redis.stop()]);
  try {
    const postgresUrl = databaseUrl(postgres.getConnectionUri(), '');
    await Promise.all(moduleDatabases().map((db) => createTemplate(postgresUrl, db)));
    provide('postgresUrl', postgresUrl);
    provide('redisUrl', redis.getConnectionUrl());
  } catch (err) {
    await stop();
    throw err;
  }
  return stop;
}
