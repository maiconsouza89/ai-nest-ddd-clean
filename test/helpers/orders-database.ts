import { OrderItemOrmEntity } from '../../src/modules/orders/infra/database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from '../../src/modules/orders/infra/database/typeorm/entities/order.orm-entity';
import { CreateOrdersSchema1795235672712 } from '../../src/modules/orders/infra/database/typeorm/migrations/1795235672712-create-orders-schema';
import { CreateOrdersTables1795235688952 } from '../../src/modules/orders/infra/database/typeorm/migrations/1795235688952-create-orders-tables';
import { AddOrderVersion1795239472968 } from '../../src/modules/orders/infra/database/typeorm/migrations/1795239472968-add-order-version';
import { OutboxMessageOrmEntity } from '../../src/shared/infra/outbox/outbox-message.orm-entity';
import { CreateSharedSchema1795240400000 } from '../../src/shared/infra/outbox/migrations/1795240400000-create-shared-schema';
import { CreateOutboxTable1795240855117 } from '../../src/shared/infra/outbox/migrations/1795240855117-create-outbox-table';
import { startDatabase } from './database';

export const startOrdersDatabase = () =>
  startDatabase({
    // o orders também grava na outbox compartilhada
    entities: [OrderOrmEntity, OrderItemOrmEntity, OutboxMessageOrmEntity],
    migrations: [
      CreateOrdersSchema1795235672712,
      CreateOrdersTables1795235688952,
      AddOrderVersion1795239472968,
      CreateSharedSchema1795240400000,
      CreateOutboxTable1795240855117,
    ],
    migrationsTableName: 'orders_migrations',
  });
