import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clock } from '#shared/application/ports/clock';
import { Logger } from '#shared/application/ports/logger';
import { Outbox } from '#shared/application/ports/outbox';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';
import { provideErrorStatuses } from '#shared/infra/http/error-status.registry';
import { UuidV7Generator } from '#shared/infra/ids/uuid-v7.generator';
import { CatalogModule } from '#modules/catalog/catalog.module';
import { CatalogFacade } from '#modules/catalog/contracts/catalog.facade';
import { InventoryModule } from '#modules/inventory/infra/inventory.module';
import { InventoryFacade } from '#modules/inventory/contracts/inventory.facade';
import { IdempotencyStore } from '../application/ports/idempotency-store.js';
import { PaymentGateway } from '../application/ports/payment-gateway.js';
import { OrderQueries } from '../application/queries/order.queries.js';
import { PriceCatalog } from '../application/ports/price-catalog.js';
import { StockGateway } from '../application/ports/stock-gateway.js';
import { CancelOrderUseCase } from '../application/use-cases/cancel-order.use-case.js';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case.js';
import { ExpirePendingOrdersUseCase } from '../application/use-cases/expire-pending-orders.use-case.js';
import { GetOrderUseCase } from '../application/use-cases/get-order.use-case.js';
import { PayOrderUseCase } from '../application/use-cases/pay-order.use-case.js';
import { PlaceOrderUseCase } from '../application/use-cases/place-order.use-case.js';
import { OrderRepository } from '../domain/repositories/order.repository.js';
import { IdempotencyKeyOrmEntity } from './database/typeorm/entities/idempotency-key.orm-entity.js';
import { OrderItemOrmEntity } from './database/typeorm/entities/order-item.orm-entity.js';
import { OrderOrmEntity } from './database/typeorm/entities/order.orm-entity.js';
import { TypeOrmIdempotencyStore } from './database/typeorm/typeorm-idempotency.store.js';
import { TypeOrmOrderQueries } from './database/typeorm/typeorm-order.queries.js';
import { TypeOrmOrderRepository } from './database/typeorm/typeorm-order.repository.js';
import { CachedOrderQueries } from './cache/cached-order.queries.js';
import { InvalidateOrderListCacheHandler } from './events/invalidate-order-list-cache.handler.js';
import { CatalogPriceAdapter } from './gateways/catalog-price.adapter.js';
import { InventoryStockGateway } from './gateways/inventory-stock.gateway.js';
import { ResilientPaymentGateway } from './gateways/resilient-payment.gateway.js';
import { SimulatedPaymentGateway } from './gateways/simulated-payment.gateway.js';
import { ExpirePendingOrdersProcessor } from './jobs/expire-pending-orders.processor.js';
import { OrdersController } from './http/controllers/orders.controller.js';
import { ORDERS_ERROR_STATUSES } from './http/error-statuses.js';

// pedidos tratados por execução do job; o excedente fica para a próxima
const EXPIRATION_BATCH_SIZE = 100;
// rede de segurança do cache da listagem: limita o pior caso se uma invalidação por evento se perder
const ORDER_LIST_CACHE_TTL_MS = 60_000;
// por quanto tempo uma Idempotency-Key concluída continua devolvendo a mesma resposta
const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;
// Chamada ao fornecedor de pagamento: tempo máximo por tentativa e retry com backoff. Ela roda dentro
// da transação do pagamento (conexão e linha da chave presas), então o pior caso é curto de propósito:
// 2 x 3s + 200ms, cerca de 6s.
const PAYMENT_RESILIENCE = { timeoutMs: 3_000, attempts: 2, baseDelayMs: 200 };

@Module({
  imports: [
    CatalogModule,
    InventoryModule,
    TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity, IdempotencyKeyOrmEntity]),
  ],
  controllers: [OrdersController],
  providers: [
    provideErrorStatuses(ORDERS_ERROR_STATUSES),
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    TypeOrmOrderQueries,
    {
      provide: CachedOrderQueries,
      useFactory: (inner: TypeOrmOrderQueries, cache: Cache, logger: Logger) =>
        new CachedOrderQueries(inner, cache, logger, ORDER_LIST_CACHE_TTL_MS),
      inject: [TypeOrmOrderQueries, CACHE_MANAGER, Logger],
    },
    // quem lê usa o decorator com cache; o handler de invalidação usa a própria classe
    { provide: OrderQueries, useExisting: CachedOrderQueries },
    InvalidateOrderListCacheHandler,
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
    { provide: IdempotencyStore, useClass: TypeOrmIdempotencyStore },
    {
      provide: PaymentGateway,
      useFactory: (logger: Logger) =>
        new ResilientPaymentGateway(new SimulatedPaymentGateway(), PAYMENT_RESILIENCE, logger),
      inject: [Logger],
    },
    { provide: IdGenerator, useClass: UuidV7Generator },
    {
      provide: CreateOrderUseCase,
      useFactory: (
        repo: OrderRepository,
        catalog: PriceCatalog,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        tx: TransactionManager,
      ) => new CreateOrderUseCase(repo, catalog, outbox, ids, clock, tx),
      inject: [OrderRepository, PriceCatalog, Outbox, IdGenerator, Clock, TransactionManager],
    },
    {
      provide: PlaceOrderUseCase,
      useFactory: (
        repo: OrderRepository,
        stock: StockGateway,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        tx: TransactionManager,
      ) => new PlaceOrderUseCase(repo, stock, outbox, ids, clock, tx),
      inject: [OrderRepository, StockGateway, Outbox, IdGenerator, Clock, TransactionManager],
    },
    {
      provide: PayOrderUseCase,
      useFactory: (
        repo: OrderRepository,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        tx: TransactionManager,
        payments: PaymentGateway,
        idempotency: IdempotencyStore,
      ) =>
        new PayOrderUseCase(
          repo,
          outbox,
          ids,
          clock,
          tx,
          payments,
          idempotency,
          IDEMPOTENCY_KEY_TTL_MS,
        ),
      inject: [
        OrderRepository,
        Outbox,
        IdGenerator,
        Clock,
        TransactionManager,
        PaymentGateway,
        IdempotencyStore,
      ],
    },
    {
      provide: GetOrderUseCase,
      useFactory: (queries: OrderQueries) => new GetOrderUseCase(queries),
      inject: [OrderQueries],
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
    ExpirePendingOrdersProcessor,
  ],
})
export class OrdersModule {}
