import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../shared/application/ports/transaction-manager';
import { UuidV7Generator } from '../../../shared/infra/ids/uuid-v7.generator';
import { OrderQueries } from '../application/queries/order.queries';
import { PriceCatalog } from '../application/ports/price-catalog';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case';
import { PayOrderUseCase } from '../application/use-cases/pay-order.use-case';
import { PlaceOrderUseCase } from '../application/use-cases/place-order.use-case';
import { OrderRepository } from '../domain/repositories/order.repository';
import { OrderItemOrmEntity } from './database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from './database/typeorm/entities/order.orm-entity';
import { TypeOrmOrderQueries } from './database/typeorm/typeorm-order.queries';
import { TypeOrmOrderRepository } from './database/typeorm/typeorm-order.repository';
import { StaticPriceCatalog } from './gateways/static-price-catalog';
import { OrdersController } from './http/controllers/orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity])],
  controllers: [OrdersController],
  providers: [
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    { provide: OrderQueries, useClass: TypeOrmOrderQueries },
    { provide: PriceCatalog, useClass: StaticPriceCatalog },
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
      useFactory: (repo: OrderRepository, tx: TransactionManager) =>
        new PlaceOrderUseCase(repo, tx),
      inject: [OrderRepository, TransactionManager],
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
