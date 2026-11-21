import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../shared/application/ports/transaction-manager';
import { UuidV7Generator } from '../../../shared/infra/ids/uuid-v7.generator';
import { ReserveStockUseCase } from '../application/use-cases/reserve-stock.use-case';
import { InventoryFacade } from '../contracts/inventory.facade';
import { StockRepository } from '../domain/repositories/stock.repository';
import { ReservationItemOrmEntity } from './database/typeorm/entities/reservation-item.orm-entity';
import { ReservationOrmEntity } from './database/typeorm/entities/reservation.orm-entity';
import { StockItemOrmEntity } from './database/typeorm/entities/stock-item.orm-entity';
import { TypeOrmStockRepository } from './database/typeorm/typeorm-stock.repository';
import { InventoryFacadeImpl } from './inventory-facade.impl';

// Global pelo mesmo motivo do CatalogModule: o orders só pode enxergar a facade de contracts/.
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([StockItemOrmEntity, ReservationOrmEntity, ReservationItemOrmEntity]),
  ],
  providers: [
    { provide: StockRepository, useClass: TypeOrmStockRepository },
    { provide: IdGenerator, useClass: UuidV7Generator },
    {
      provide: ReserveStockUseCase,
      useFactory: (stock: StockRepository, ids: IdGenerator, tx: TransactionManager) =>
        new ReserveStockUseCase(stock, ids, tx),
      inject: [StockRepository, IdGenerator, TransactionManager],
    },
    {
      provide: InventoryFacade,
      useFactory: (reserve: ReserveStockUseCase) => new InventoryFacadeImpl(reserve),
      inject: [ReserveStockUseCase],
    },
  ],
  exports: [InventoryFacade], // nada além da facade sai do módulo
})
export class InventoryModule {}
