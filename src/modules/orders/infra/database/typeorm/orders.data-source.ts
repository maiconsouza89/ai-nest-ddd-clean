// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnv } from '../../../../../shared/infra/config/env.validation';
import { IdempotencyKeyOrmEntity } from './entities/idempotency-key.orm-entity';
import { OrderItemOrmEntity } from './entities/order-item.orm-entity';
import { OrderOrmEntity } from './entities/order.orm-entity';

config({ path: ['.env.local', '.env'], quiet: true });
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [OrderOrmEntity, OrderItemOrmEntity, IdempotencyKeyOrmEntity],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'orders_migrations',
});
