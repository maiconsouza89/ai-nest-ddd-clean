import { Module } from '@nestjs/common';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { UuidV7Generator } from '../../../shared/infra/ids/uuid-v7.generator';
import { PriceCatalog } from '../application/ports/price-catalog';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case';
import { PayOrderUseCase } from '../application/use-cases/pay-order.use-case';
import { PlaceOrderUseCase } from '../application/use-cases/place-order.use-case';
import { OrderRepository } from '../domain/repositories/order.repository';
import { InMemoryOrderRepository } from './database/in-memory/in-memory-order.repository';
import { StaticPriceCatalog } from './gateways/static-price-catalog';
import { OrdersController } from './http/controllers/orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [
    { provide: OrderRepository, useClass: InMemoryOrderRepository },
    { provide: PriceCatalog, useClass: StaticPriceCatalog },
    { provide: IdGenerator, useClass: UuidV7Generator },
    {
      provide: CreateOrderUseCase,
      useFactory: (repo: OrderRepository, catalog: PriceCatalog, ids: IdGenerator) =>
        new CreateOrderUseCase(repo, catalog, ids),
      inject: [OrderRepository, PriceCatalog, IdGenerator],
    },
    {
      provide: PlaceOrderUseCase,
      useFactory: (repo: OrderRepository) => new PlaceOrderUseCase(repo),
      inject: [OrderRepository],
    },
    {
      provide: PayOrderUseCase,
      useFactory: (repo: OrderRepository) => new PayOrderUseCase(repo),
      inject: [OrderRepository],
    },
  ],
})
export class OrdersModule {}
