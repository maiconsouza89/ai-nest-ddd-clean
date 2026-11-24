// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFiles } from '#shared/infra/config/load-env-files';
import { validateEnv } from '#shared/infra/config/env.validation';
import { ReservationItemOrmEntity } from './entities/reservation-item.orm-entity.js';
import { ReservationOrmEntity } from './entities/reservation.orm-entity.js';
import { StockItemOrmEntity } from './entities/stock-item.orm-entity.js';

loadEnvFiles();
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [StockItemOrmEntity, ReservationOrmEntity, ReservationItemOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'inventory_migrations',
});
