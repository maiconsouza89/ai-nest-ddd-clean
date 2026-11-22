import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import 'reflect-metadata';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthIndicatorService, TerminusModule } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import { StartedRedisContainer } from '@testcontainers/redis';
import { DataSource } from 'typeorm';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startOrdersDatabase } from '#test/helpers/orders-database';
import { startRedis } from '#test/helpers/redis';
import { Logger } from '#shared/application/ports/logger';
import { Money } from '#shared/domain/money.vo';
import { AppCacheModule } from '#shared/infra/cache/cache.module';
import { RedisConnection } from '#shared/infra/cache/redis.connection';
import { RedisHealthIndicator } from '#shared/infra/health/redis-health.indicator';
import { OrderQueries } from '../../application/queries/order.queries.js';
import { Order } from '../../domain/entities/order.entity.js';
import { TypeOrmOrderQueries } from '../database/typeorm/typeorm-order.queries.js';
import { TypeOrmOrderRepository } from '../database/typeorm/typeorm-order.repository.js';
import { InvalidateOrderListCacheHandler } from '../events/invalidate-order-list-cache.handler.js';
import { CachedOrderQueries } from './cached-order.queries.js';

const logger = new FakeLogger();

// no app real, o Logger vem do módulo de observabilidade (global)
@Global()
@Module({ providers: [{ provide: Logger, useValue: logger }], exports: [Logger] })
class TestLoggerModule {}

describe('CachedOrderQueries (integração: Postgres e Redis)', () => {
  let ds: DataSource;
  let stopDb: () => Promise<void>;
  let redis: StartedRedisContainer;
  let app: TestingModule;
  let repo: TypeOrmOrderRepository;
  let inner: TypeOrmOrderQueries;
  let queries: OrderQueries;
  let handler: InvalidateOrderListCacheHandler;
  let cache: Cache;
  let health: RedisHealthIndicator;

  beforeAll(async () => {
    ({ ds, stop: stopDb } = await startOrdersDatabase());
    redis = await startRedis();
    repo = new TypeOrmOrderRepository(ds);
    inner = new TypeOrmOrderQueries(ds);

    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ REDIS_URL: redis.getConnectionUrl() })],
        }),
        TerminusModule,
        TestLoggerModule,
        AppCacheModule,
      ],
      providers: [
        { provide: TypeOrmOrderQueries, useValue: inner },
        {
          provide: CachedOrderQueries,
          useFactory: (cache: Cache) => new CachedOrderQueries(inner, cache, logger, 60_000),
          inject: [CACHE_MANAGER],
        },
        InvalidateOrderListCacheHandler,
        {
          provide: RedisHealthIndicator,
          useFactory: (indicators: HealthIndicatorService, connection: RedisConnection) =>
            new RedisHealthIndicator(indicators, connection),
          inject: [HealthIndicatorService, RedisConnection],
        },
      ],
    }).compile();
    await app.init();
    queries = app.get(CachedOrderQueries);
    handler = app.get(InvalidateOrderListCacheHandler);
    cache = app.get(CACHE_MANAGER);
    health = app.get(RedisHealthIndicator);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    // o teste do Redis parado já o encerrou; parar de novo é inofensivo
    await redis?.stop().catch(() => undefined);
    await stopDb?.();
  }, 60_000);

  async function seed(customerId: string) {
    const order = Order.create(crypto.randomUUID(), customerId);
    order.addItem('p1', 1, Money.fromCents(1000));
    await repo.save(order);
    return order;
  }

  const first = { page: 1, limit: 20 };

  it('a segunda listagem igual não vai ao Postgres', async () => {
    await seed('hit');
    const spy = vi.spyOn(inner, 'listByCustomer');

    const a = await queries.listByCustomer('hit', first);
    const b = await queries.listByCustomer('hit', first);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a); // inclusive as datas, que passam por JSON no Redis
    spy.mockRestore();
  });

  it('uma escrita no pedido, avisada por evento, faz a próxima listagem vir atualizada', async () => {
    const order = await seed('fresh');
    expect((await queries.listByCustomer('fresh', first)).items[0].status).toBe('DRAFT');

    // é o que o worker da outbox entrega depois do commit
    const placed = (await repo.findById(order.id))!;
    placed.place();
    await repo.save(placed);
    expect((await queries.listByCustomer('fresh', first)).items[0].status).toBe('DRAFT'); // ainda em cache

    await handler.onOrderListChanged({
      eventId: crypto.randomUUID(),
      type: 'orders.order-placed',
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: { orderId: order.id, customerId: 'fresh' },
    });

    expect((await queries.listByCustomer('fresh', first)).items[0].status).toBe('PLACED');
  });

  it('as chaves de cache têm TTL', async () => {
    await seed('ttl');
    await queries.listByCustomer('ttl', first);

    const keys = await app.get(RedisConnection).client.keys('*ttl*');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(await app.get(RedisConnection).client.ttl(key)).toBeGreaterThan(0);
    }
  });

  it('com o Redis parado, a listagem continua respondendo e o health check falha', async () => {
    await seed('down');
    expect(await health.pingCheck('redis', { timeout: 1000 })).toEqual({ redis: { status: 'up' } });

    await redis.stop();
    const spy = vi.spyOn(inner, 'listByCustomer');

    const page = await queries.listByCustomer('down', first);
    await queries.listByCustomer('down', first);

    expect(page.items).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2); // sem cache, cada leitura vai ao banco
    expect(await health.pingCheck('redis', { timeout: 1000 })).toMatchObject({
      redis: { status: 'down' },
    });
    // a escrita e a invalidação também não derrubam nada
    await expect(cache.set('x', 1)).resolves.toBeDefined();
    spy.mockRestore();
  }, 30_000);
});
