import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '../../../shared/infra/messaging/messaging.module';
import { Clock } from '../../../shared/application/ports/clock';
import { Logger } from '../../../shared/application/ports/logger';
import { Outbox } from '../../../shared/application/ports/outbox';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../shared/application/ports/transaction-manager';
import { EnvironmentVariables } from '../../../shared/infra/config/env.validation';
import { UuidV7Generator } from '../../../shared/infra/ids/uuid-v7.generator';
import { CatalogFacade } from '../../catalog/contracts/catalog.facade';
import { InventoryFacade } from '../../inventory/contracts/inventory.facade';
import { IdempotencyStore } from '../application/ports/idempotency-store';
import { PaymentGateway } from '../application/ports/payment-gateway';
import { OrderQueries } from '../application/queries/order.queries';
import { PriceCatalog } from '../application/ports/price-catalog';
import { StockGateway } from '../application/ports/stock-gateway';
import { CancelOrderUseCase } from '../application/use-cases/cancel-order.use-case';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case';
import { ExpirePendingOrdersUseCase } from '../application/use-cases/expire-pending-orders.use-case';
import { PayOrderUseCase } from '../application/use-cases/pay-order.use-case';
import { PlaceOrderUseCase } from '../application/use-cases/place-order.use-case';
import { OrderRepository } from '../domain/repositories/order.repository';
import { IdempotencyKeyOrmEntity } from './database/typeorm/entities/idempotency-key.orm-entity';
import { OrderItemOrmEntity } from './database/typeorm/entities/order-item.orm-entity';
import { OrderOrmEntity } from './database/typeorm/entities/order.orm-entity';
import { TypeOrmIdempotencyStore } from './database/typeorm/typeorm-idempotency.store';
import { TypeOrmOrderQueries } from './database/typeorm/typeorm-order.queries';
import { TypeOrmOrderRepository } from './database/typeorm/typeorm-order.repository';
import { CachedOrderQueries } from './cache/cached-order.queries';
import { InvalidateOrderListCacheHandler } from './events/invalidate-order-list-cache.handler';
import { CatalogPriceAdapter } from './gateways/catalog-price.adapter';
import { InventoryStockGateway } from './gateways/inventory-stock.gateway';
import { ResilientPaymentGateway } from './gateways/resilient-payment.gateway';
import { SimulatedPaymentGateway } from './gateways/simulated-payment.gateway';
import { ExpirePendingOrdersProcessor } from './jobs/expire-pending-orders.processor';
import { OrdersController } from './http/controllers/orders.controller';

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
    MessagingModule,
    TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity, IdempotencyKeyOrmEntity]),
  ],
  controllers: [OrdersController],
  providers: [
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
