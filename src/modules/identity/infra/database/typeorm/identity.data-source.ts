// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFiles } from '#shared/infra/config/load-env-files';
import { validateEnv } from '#shared/infra/config/env.validation';
import { RefreshTokenOrmEntity } from './entities/refresh-token.orm-entity.js';
import { UserOrmEntity } from './entities/user.orm-entity.js';
import { VerificationCodeOrmEntity } from './entities/verification-code.orm-entity.js';

loadEnvFiles();
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [UserOrmEntity, RefreshTokenOrmEntity, VerificationCodeOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'identity_migrations',
});
