import { ReservationItemOrmEntity } from '#modules/inventory/infra/database/typeorm/entities/reservation-item.orm-entity';
import { ReservationOrmEntity } from '#modules/inventory/infra/database/typeorm/entities/reservation.orm-entity';
import { StockItemOrmEntity } from '#modules/inventory/infra/database/typeorm/entities/stock-item.orm-entity';
import { CreateInventorySchema1795239950000 } from '#modules/inventory/infra/database/typeorm/migrations/1795239950000-create-inventory-schema';
import { CreateInventoryTables1795240302737 } from '#modules/inventory/infra/database/typeorm/migrations/1795240302737-create-inventory-tables';
import { AddReservationReleasedAt1795270216004 } from '#modules/inventory/infra/database/typeorm/migrations/1795270216004-add-reservation-released-at';
import { startDatabase } from './database.js';

export const startInventoryDatabase = () =>
  startDatabase({
    entities: [StockItemOrmEntity, ReservationOrmEntity, ReservationItemOrmEntity],
    migrations: [
      CreateInventorySchema1795239950000,
      CreateInventoryTables1795240302737,
      AddReservationReleasedAt1795270216004,
    ],
    migrationsTableName: 'inventory_migrations',
  });
