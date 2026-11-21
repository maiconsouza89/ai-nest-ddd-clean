import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../shared/application/ports/transaction-manager';
import { UuidV7Generator } from '../../../shared/infra/ids/uuid-v7.generator';
import { CatalogFacade } from '../../catalog/contracts/catalog.facade';
import { InventoryFacade } from '../../inventory/contracts/inventory.facade';
import { OrderQueries } from '../application/queries/order.queries';
import { PriceCatalog } from '../application/ports/price-catalog';
import { StockGateway } from '../application/ports/stock-gateway';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case';
import { PayOrderUseCase } from '../application/use-cases/pay-order.use-case';
import { PlaceOrderUseCase } from '../application/use-cases/place-order.use-case';
import { OrderRepository } from '../domain/repositories/order.repository';
import { OrderItemOrmEntity } from './database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from './database/typeorm/entities/order.orm-entity';
import { TypeOrmOrderQueries } from './database/typeorm/typeorm-order.queries';
import { TypeOrmOrderRepository } from './database/typeorm/typeorm-order.repository';
import { CatalogPriceAdapter } from './gateways/catalog-price.adapter';
import { InventoryStockGateway } from './gateways/inventory-stock.gateway';
import { OrdersController } from './http/controllers/orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity])],
  controllers: [OrdersController],
  providers: [
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    { provide: OrderQueries, useClass: TypeOrmOrderQueries },
    {
      provide: PriceCatalog,
      useFactory: (catalog: CatalogFacade) => new CatalogPriceAdapter(catalog),
      inject: [CatalogFacade],
    },
    {
      provide: StockGateway,
      useFactory: (inventory: InventoryFacade) => new InventoryStockGateway(inventory),
      inject: [InventoryFacade],
    },
    { provide: IdGenerator, useClass: UuidV7Generator },
    {
      provide: CreateOrderUseCase,
      useFactory: (
        repo: OrderRepository,
        catalog: PriceCatalog,
        ids: IdGenerator,
        tx: TransactionManager,
      ) => new CreateOrderUseCase(repo, catalog, ids, tx),
      inject: [OrderRepository, PriceCatalog, IdGenerator, TransactionManager],
    },
    {
      provide: PlaceOrderUseCase,
      useFactory: (repo: OrderRepository, stock: StockGateway, tx: TransactionManager) =>
        new PlaceOrderUseCase(repo, stock, tx),
      inject: [OrderRepository, StockGateway, TransactionManager],
    },
    {
      provide: PayOrderUseCase,
      useFactory: (repo: OrderRepository, tx: TransactionManager) =>
        new PayOrderUseCase(repo, tx),
      inject: [OrderRepository, TransactionManager],
    },
  ],
})
export class OrdersModule {}
