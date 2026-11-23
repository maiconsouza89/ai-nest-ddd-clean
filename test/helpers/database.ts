import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, DataSourceOptions } from 'typeorm';

type ModuleDatabase = {
  entities: NonNullable<DataSourceOptions['entities']>;
  migrations: NonNullable<DataSourceOptions['migrations']>;
  migrationsTableName: string;
};

// Sobe um Postgres descartável e aplica as migrations reais de um módulo.
export async function startDatabase({ entities, migrations, migrationsTableName }: ModuleDatabase) {
  const container = await new PostgreSqlContainer('postgres:19').start();
  const ds = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities,
    migrations,
    migrationsTableName,
  });
  await ds.initialize();
  await ds.runMigrations();
  return {
    ds,
    stop: async () => {
      await ds.destroy();
      await container.stop();
    },
  };
}
