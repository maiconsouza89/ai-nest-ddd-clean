// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { OutboxMessageOrmEntity } from './outbox-message.orm-entity';

config({ path: ['.env.local', '.env'], quiet: true });
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [OutboxMessageOrmEntity],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'shared_migrations',
});
