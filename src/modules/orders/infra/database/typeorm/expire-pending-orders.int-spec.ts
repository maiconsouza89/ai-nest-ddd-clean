import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakeLogger } from '../../../../../../test/fakes/fake-logger';
import { startOrdersDatabase } from '../../../../../../test/helpers/orders-database';
import { Money } from '../../../../../shared/domain/money.vo';
import { SystemClock } from '../../../../../shared/infra/clock/system-clock';
import { TypeOrmTransactionManager } from '../../../../../shared/infra/database/typeorm-transaction-manager';
import { UuidV7Generator } from '../../../../../shared/infra/ids/uuid-v7.generator';
import { TypeOrmOutbox } from '../../../../../shared/infra/outbox/typeorm-outbox';
import { ExpirePendingOrdersUseCase } from '../../../application/use-cases/expire-pending-orders.use-case';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatus } from '../../../domain/value-objects/order-status.vo';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

describe('Jobs de pedidos com Postgres (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmOrderRepository;
  let useCase: ExpirePendingOrdersUseCase;
  beforeAll(async () => {
    ({ ds, stop } = await startOrdersDatabase());
    repo = new TypeOrmOrderRepository(ds);
    useCase = new ExpirePendingOrdersUseCase(
      repo,
      new TypeOrmOutbox(ds),
      new UuidV7Generator(),
      new SystemClock(),
      new TypeOrmTransactionManager(ds),
      new FakeLogger(),
      { maxIdleMs: 60 * 60_000, batchSize: 100 },
    );
  }, 120_000);

  afterAll(() => stop?.());

  async function seed(status: 'DRAFT' | 'PLACED' | 'PAID', idleHours: number) {
    const order = Order.create(crypto.randomUUID(), 'u1');
    order.addItem('p1', 1, Money.fromCents(100));
    if (status !== 'DRAFT') order.place();
    if (status === 'PAID') order.pay();
    await repo.save(order);
    await ds.query(
      `UPDATE orders.orders SET "updatedAt" = now() - make_interval(hours => $2) WHERE id = $1`,
      [order.id, idleHours],
    );
    return order.id;
  }

  const statusOf = async (id: string) => (await repo.findById(id))!.status;

  it('cancela só os parados e grava OrderCancelled na outbox', async () => {
    const stale = await seed('PLACED', 2);
    const recent = await seed('PLACED', 0);
    const paid = await seed('PAID', 5);

    expect(await useCase.execute()).toBe(1);

    expect(await statusOf(stale)).toBe(OrderStatus.CANCELLED);
    expect(await statusOf(recent)).toBe(OrderStatus.PLACED);
    expect(await statusOf(paid)).toBe(OrderStatus.PAID);
    const rows = await ds.query(`SELECT type FROM shared.outbox WHERE payload->>'orderId' = $1`, [
      stale,
    ]);
    expect(rows).toEqual([{ type: 'orders.order-cancelled' }]);
  });
});
