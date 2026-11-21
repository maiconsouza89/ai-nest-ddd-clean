import { OrderItemOrmEntity } from '../../src/modules/orders/infra/database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from '../../src/modules/orders/infra/database/typeorm/entities/order.orm-entity';
import { CreateOrdersSchema1795235672712 } from '../../src/modules/orders/infra/database/typeorm/migrations/1795235672712-create-orders-schema';
import { CreateOrdersTables1795235688952 } from '../../src/modules/orders/infra/database/typeorm/migrations/1795235688952-create-orders-tables';
import { startDatabase } from './database';

export const startOrdersDatabase = () =>
  startDatabase({
    entities: [OrderOrmEntity, OrderItemOrmEntity],
    migrations: [CreateOrdersSchema1795235672712, CreateOrdersTables1795235688952],
    migrationsTableName: 'orders_migrations',
  });
