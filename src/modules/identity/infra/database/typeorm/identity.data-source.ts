// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnv } from '#shared/infra/config/env.validation';
import { UserOrmEntity } from './entities/user.orm-entity.js';

config({ path: ['.env.local', '.env'], quiet: true });
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [UserOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'identity_migrations',
});
