import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clock } from '../../../shared/application/ports/clock';
import { Logger } from '../../../shared/application/ports/logger';
import { Outbox } from '../../../shared/application/ports/outbox';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../shared/application/ports/transaction-manager';
import { EnvironmentVariables } from '../../../shared/infra/config/env.validation';
import { UuidV7Generator } from '../../../shared/infra/ids/uuid-v7.generator';
import { CatalogFacade } from '../../catalog/contracts/catalog.facade';
import { InventoryFacade } from '../../inventory/contracts/inventory.facade';
import { OrderQueries } from '../application/queries/order.queries';
import { PriceCatalog } from '../application/ports/price-catalog';
import { StockGateway } from '../application/ports/stock-gateway';
import { CancelOrderUseCase } from '../application/use-cases/cancel-order.use-case';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case';
import { ExpirePendingOrdersUseCase } from '../application/use-cases/expire-pending-orders.use-case';
import { PayOrderUseCase } from '../application/use-cases/pay-order.use-case';
import { PlaceOrderUseCase } from '../application/use-cases/place-order.use-case';
import { OrderRepository } from '../domain/repositories/order.repository';
import { OrderItemOrmEntity } from './database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from './database/typeorm/entities/order.orm-entity';
import { TypeOrmOrderQueries } from './database/typeorm/typeorm-order.queries';
import { TypeOrmOrderRepository } from './database/typeorm/typeorm-order.repository';
import { CatalogPriceAdapter } from './gateways/catalog-price.adapter';
import { InventoryStockGateway } from './gateways/inventory-stock.gateway';
import { ExpirePendingOrdersJob } from './jobs/expire-pending-orders.job';
import { OrdersController } from './http/controllers/orders.controller';

// pedidos tratados por execução do job; o excedente fica para a próxima
const EXPIRATION_BATCH_SIZE = 100;

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
      useFactory: (
        repo: OrderRepository,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        tx: TransactionManager,
      ) => new PayOrderUseCase(repo, outbox, ids, clock, tx),
      inject: [OrderRepository, Outbox, IdGenerator, Clock, TransactionManager],
    },
    {
      provide: CancelOrderUseCase,
      useFactory: (
        repo: OrderRepository,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        tx: TransactionManager,
      ) => new CancelOrderUseCase(repo, outbox, ids, clock, tx),
      inject: [OrderRepository, Outbox, IdGenerator, Clock, TransactionManager],
    },
    {
      provide: ExpirePendingOrdersUseCase,
      useFactory: (
        repo: OrderRepository,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        tx: TransactionManager,
        logger: Logger,
        config: ConfigService<EnvironmentVariables, true>,
      ) =>
        new ExpirePendingOrdersUseCase(repo, outbox, ids, clock, tx, logger, {
          maxIdleMs: config.getOrThrow('ORDER_EXPIRATION_MINUTES', { infer: true }) * 60_000,
          batchSize: EXPIRATION_BATCH_SIZE,
        }),
      inject: [
        OrderRepository,
        Outbox,
        IdGenerator,
        Clock,
        TransactionManager,
        Logger,
        ConfigService,
      ],
    },
    ExpirePendingOrdersJob,
  ],
})
export class OrdersModule {}
