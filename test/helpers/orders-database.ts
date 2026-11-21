import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { OrderItemOrmEntity } from '../../src/modules/orders/infra/database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from '../../src/modules/orders/infra/database/typeorm/entities/order.orm-entity';
import { CreateOrdersSchema1795235672712 } from '../../src/modules/orders/infra/database/typeorm/migrations/1795235672712-create-orders-schema';
import { CreateOrdersTables1795235688952 } from '../../src/modules/orders/infra/database/typeorm/migrations/1795235688952-create-orders-tables';

// Sobe um Postgres descartável e aplica as migrations reais do módulo orders.
export async function startOrdersDatabase() {
  const container = await new PostgreSqlContainer('postgres:17').start();
  const ds = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities: [OrderOrmEntity, OrderItemOrmEntity],
    migrations: [CreateOrdersSchema1795235672712, CreateOrdersTables1795235688952],
    migrationsTableName: 'orders_migrations',
  });
  await ds.initialize();
  await ds.runMigrations();
  return {
    ds,
    stop: async () => {
      await ds.destroy();
      await container.stop();
    },
  };
}
