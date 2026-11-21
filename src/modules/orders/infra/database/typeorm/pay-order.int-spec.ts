import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FixedClock } from '../../../../../../test/fakes/fixed-clock';
import { startOrdersDatabase } from '../../../../../../test/helpers/orders-database';
import { Outbox } from '../../../../../shared/application/ports/outbox';
import { Money } from '../../../../../shared/domain/money.vo';
import { TypeOrmTransactionManager } from '../../../../../shared/infra/database/typeorm-transaction-manager';
import { UuidV7Generator } from '../../../../../shared/infra/ids/uuid-v7.generator';
import { TypeOrmOutbox } from '../../../../../shared/infra/outbox/typeorm-outbox';
import { PayOrderUseCase } from '../../../application/use-cases/pay-order.use-case';
import { Order } from '../../../domain/entities/order.entity';
import { OrderRepository } from '../../../domain/repositories/order.repository';
import { OrderStatus } from '../../../domain/value-objects/order-status.vo';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

describe('PayOrderUseCase com Postgres (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmOrderRepository;
  let outbox: TypeOrmOutbox;
  const tx = () => new TypeOrmTransactionManager(ds);
  const actor = { id: 'u1', roles: [] };

  beforeAll(async () => {
    ({ ds, stop } = await startOrdersDatabase());
    repo = new TypeOrmOrderRepository(ds);
    outbox = new TypeOrmOutbox(ds);
  }, 120_000);

  afterAll(() => stop?.());

  const useCase = (orders: OrderRepository, box: Outbox) =>
    new PayOrderUseCase(orders, box, new UuidV7Generator(), new FixedClock(), tx());

  async function placedOrder() {
    const order = Order.create(crypto.randomUUID(), 'u1');
    order.addItem('p1', 2, Money.fromCents(500));
    order.place();
    await repo.save(order);
    return order.id;
  }

  const outboxRows = (orderId: string) =>
    ds.query(`SELECT type, version, payload FROM shared.outbox WHERE payload->>'orderId' = $1`, [
      orderId,
    ]);

  it('pagar grava o pedido pago e uma linha na outbox', async () => {
    const id = await placedOrder();

    await useCase(repo, outbox).execute({ orderId: id, actor });

    expect((await repo.findById(id))!.status).toBe(OrderStatus.PAID);
    expect(await outboxRows(id)).toEqual([
      {
        type: 'orders.order-paid',
        version: 1,
        payload: { orderId: id, customerId: 'u1', totalCents: 1000, currency: 'BRL' },
      },
    ]);
  });

  it('falha ao gravar o pedido não cria linha na outbox', async () => {
    const id = await placedOrder();
    const failingRepo: OrderRepository = {
      findById: (orderId) => repo.findById(orderId),
      save: async () => {
        throw new Error('falha no save');
      },
    };

    await expect(useCase(failingRepo, outbox).execute({ orderId: id, actor })).rejects.toThrow(
      'falha no save',
    );

    expect(await outboxRows(id)).toEqual([]);
    expect((await repo.findById(id))!.status).toBe(OrderStatus.PLACED);
  });

  it('falha ao gravar na outbox desfaz o pagamento do pedido', async () => {
    const id = await placedOrder();
    const failingOutbox: Outbox = {
      add: async () => {
        throw new Error('falha na outbox');
      },
    };

    await expect(useCase(repo, failingOutbox).execute({ orderId: id, actor })).rejects.toThrow(
      'falha na outbox',
    );

    expect((await repo.findById(id))!.status).toBe(OrderStatus.PLACED);
  });
});
