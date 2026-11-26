import { CreateSharedSchema1795240400000 } from '#shared/infra/outbox/migrations/1795240400000-create-shared-schema';
import { CreateOutboxTable1795240855117 } from '#shared/infra/outbox/migrations/1795240855117-create-outbox-table';
import { AddOutboxDeliveryState1795241392729 } from '#shared/infra/outbox/migrations/1795241392729-add-outbox-delivery-state';
import { AddOutboxMetadata1795243000000 } from '#shared/infra/outbox/migrations/1795243000000-add-outbox-metadata';
import { AddOutboxDeadIndex1795647672444 } from '#shared/infra/outbox/migrations/1795647672444-add-outbox-dead-index';
import { OutboxMessageOrmEntity } from '#shared/infra/outbox/outbox-message.orm-entity';
import { CreateProcessedEventsTable1795242000000 } from '#shared/infra/outbox/migrations/1795242000000-create-processed-events-table';
import { ProcessedEventOrmEntity } from '#shared/infra/outbox/processed-event.orm-entity';
import { ModuleDatabase, startDatabase } from './database.js';

export const outboxEntities = [OutboxMessageOrmEntity, ProcessedEventOrmEntity];
export const outboxMigrations = [
  CreateSharedSchema1795240400000,
  CreateOutboxTable1795240855117,
  AddOutboxDeliveryState1795241392729,
  CreateProcessedEventsTable1795242000000,
  AddOutboxMetadata1795243000000,
  AddOutboxDeadIndex1795647672444,
];

export const outboxDatabase: ModuleDatabase = {
  template: 'outbox',
  entities: outboxEntities,
  migrations: outboxMigrations,
  migrationsTableName: 'shared_migrations',
};

export const startOutboxDatabase = () => startDatabase(outboxDatabase);
