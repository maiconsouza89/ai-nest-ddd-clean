import { CreateSharedSchema1795240400000 } from '../../src/shared/infra/outbox/migrations/1795240400000-create-shared-schema';
import { CreateOutboxTable1795240855117 } from '../../src/shared/infra/outbox/migrations/1795240855117-create-outbox-table';
import { AddOutboxDeliveryState1795241392729 } from '../../src/shared/infra/outbox/migrations/1795241392729-add-outbox-delivery-state';
import { OutboxMessageOrmEntity } from '../../src/shared/infra/outbox/outbox-message.orm-entity';
import { CreateProcessedEventsTable1795242000000 } from '../../src/shared/infra/outbox/migrations/1795242000000-create-processed-events-table';
import { ProcessedEventOrmEntity } from '../../src/shared/infra/outbox/processed-event.orm-entity';
import { startDatabase } from './database';

export const outboxEntities = [OutboxMessageOrmEntity, ProcessedEventOrmEntity];
export const outboxMigrations = [
  CreateSharedSchema1795240400000,
  CreateOutboxTable1795240855117,
  AddOutboxDeliveryState1795241392729,
  CreateProcessedEventsTable1795242000000,
];

export const startOutboxDatabase = () =>
  startDatabase({
    entities: outboxEntities,
    migrations: outboxMigrations,
    migrationsTableName: 'shared_migrations',
  });
