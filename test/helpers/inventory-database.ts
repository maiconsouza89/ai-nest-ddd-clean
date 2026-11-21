import { ReservationItemOrmEntity } from '../../src/modules/inventory/infra/database/typeorm/entities/reservation-item.orm-entity';
import { ReservationOrmEntity } from '../../src/modules/inventory/infra/database/typeorm/entities/reservation.orm-entity';
import { StockItemOrmEntity } from '../../src/modules/inventory/infra/database/typeorm/entities/stock-item.orm-entity';
import { CreateInventorySchema1795239950000 } from '../../src/modules/inventory/infra/database/typeorm/migrations/1795239950000-create-inventory-schema';
import { CreateInventoryTables1795240302737 } from '../../src/modules/inventory/infra/database/typeorm/migrations/1795240302737-create-inventory-tables';
import { startDatabase } from './database';

export const startInventoryDatabase = () =>
  startDatabase({
    entities: [StockItemOrmEntity, ReservationOrmEntity, ReservationItemOrmEntity],
    migrations: [CreateInventorySchema1795239950000, CreateInventoryTables1795240302737],
    migrationsTableName: 'inventory_migrations',
  });
