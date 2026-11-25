// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFiles } from '#shared/infra/config/load-env-files';
import { validateEnv } from '#shared/infra/config/env.validation';
import { postgresOptions } from '#shared/infra/database/postgres-options';
import { IdempotencyKeyOrmEntity } from './entities/idempotency-key.orm-entity.js';
import { OrderItemOrmEntity } from './entities/order-item.orm-entity.js';
import { OrderOrmEntity } from './entities/order.orm-entity.js';

loadEnvFiles();
const env = validateEnv(process.env);

export default new DataSource({
  ...postgresOptions(env, { migrations: true }),
  entities: [OrderOrmEntity, OrderItemOrmEntity, IdempotencyKeyOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'orders_migrations',
});
