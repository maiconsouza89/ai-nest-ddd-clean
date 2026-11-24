// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFiles } from '#shared/infra/config/load-env-files';
import { validateEnv } from '#shared/infra/config/env.validation';
import { ProductOrmEntity } from '../product.orm-entity.js';

loadEnvFiles();
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [ProductOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'catalog_migrations',
});
