// DataSource usado só pela CLI de migrations (não passa pelo Nest).
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation.js';
import { OutboxMessageOrmEntity } from './outbox-message.orm-entity.js';
import { ProcessedEventOrmEntity } from './processed-event.orm-entity.js';

config({ path: ['.env.local', '.env'], quiet: true });
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [OutboxMessageOrmEntity, ProcessedEventOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'shared_migrations',
});
