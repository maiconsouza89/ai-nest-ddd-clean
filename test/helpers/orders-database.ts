import { IdempotencyKeyOrmEntity } from '#modules/orders/infra/database/typeorm/entities/idempotency-key.orm-entity';
import { OrderItemOrmEntity } from '#modules/orders/infra/database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from '#modules/orders/infra/database/typeorm/entities/order.orm-entity';
import { CreateOrdersSchema1795235672712 } from '#modules/orders/infra/database/typeorm/migrations/1795235672712-create-orders-schema';
import { CreateOrdersTables1795235688952 } from '#modules/orders/infra/database/typeorm/migrations/1795235688952-create-orders-tables';
import { AddOrderVersion1795239472968 } from '#modules/orders/infra/database/typeorm/migrations/1795239472968-add-order-version';
import { CreateIdempotencyKeys1795300000000 } from '#modules/orders/infra/database/typeorm/migrations/1795300000000-create-idempotency-keys';
import { ModuleDatabase, startDatabase } from './database.js';
import { outboxEntities, outboxMigrations } from './outbox-database.js';

export const ordersDatabase: ModuleDatabase = {
  template: 'orders',
  // o orders também grava na outbox compartilhada
  entities: [OrderOrmEntity, OrderItemOrmEntity, IdempotencyKeyOrmEntity, ...outboxEntities],
  migrations: [
    CreateOrdersSchema1795235672712,
    CreateOrdersTables1795235688952,
    AddOrderVersion1795239472968,
    CreateIdempotencyKeys1795300000000,
    ...outboxMigrations,
  ],
  migrationsTableName: 'orders_migrations',
};

export const startOrdersDatabase = () => startDatabase(ordersDatabase);
