import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakePaymentGateway } from '#test/fakes/fake-payment-gateway';
import { FixedClock } from '#test/fakes/fixed-clock';
import { startOrdersDatabase } from '#test/helpers/orders-database';
import { Outbox } from '#shared/application/ports/outbox';
import { Money } from '#shared/domain/money.vo';
import { TypeOrmTransactionManager } from '#shared/infra/database/typeorm-transaction-manager';
import { UuidV7Generator } from '#shared/infra/runtime/uuid-v7.generator';
import { TypeOrmOutbox } from '#shared/infra/outbox/typeorm-outbox';
import { PaymentUnavailableError } from '../../../domain/errors/payment-unavailable.error.js';
import { ConcurrencyError } from '#shared/domain/concurrency.error';
import { CancelOrderUseCase } from '../../../application/use-cases/cancel-order.use-case.js';
import { PayOrderUseCase } from '../../../application/use-cases/pay-order.use-case.js';
import { Order } from '../../../domain/entities/order.entity.js';
import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { OrderStatus } from '../../../domain/value-objects/order-status.vo.js';
import { TypeOrmIdempotencyStore } from './typeorm-idempotency.store.js';
import { TypeOrmOrderRepository } from './typeorm-order.repository.js';

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
  });

  afterAll(() => stop?.());

  const useCase = (orders: OrderRepository, box: Outbox, payments = new FakePaymentGateway()) =>
    new PayOrderUseCase(
      orders,
      box,
      new UuidV7Generator(),
      new FixedClock(),
      tx(),
      payments,
      new TypeOrmIdempotencyStore(ds),
      60_000,
    );

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
    const failingRepo: OrderRepository = Object.assign(Object.create(repo), {
      save: async () => {
        throw new Error('falha no save');
      },
    });

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

  it('fornecedor de pagamento fora do ar deixa o pedido fechado e sem evento', async () => {
    const id = await placedOrder();
    const payments = new FakePaymentGateway();
    payments.unavailable = true;

    await expect(useCase(repo, outbox, payments).execute({ orderId: id, actor })).rejects.toThrow(
      PaymentUnavailableError,
    );

    expect((await repo.findById(id))!.status).toBe(OrderStatus.PLACED);
    expect(await outboxRows(id)).toEqual([]);
  });

  it('repetir com a mesma Idempotency-Key cobra e publica uma vez só', async () => {
    const id = await placedOrder();
    const payments = new FakePaymentGateway();
    const pay = useCase(repo, outbox, payments);

    await pay.execute({ orderId: id, actor, idempotencyKey: 'key-1' });
    await pay.execute({ orderId: id, actor, idempotencyKey: 'key-1' });

    expect(payments.charges).toHaveLength(1);
    expect(await outboxRows(id)).toHaveLength(1);
  });

  it('falha na cobrança não queima a Idempotency-Key: a nova tentativa cobra e paga', async () => {
    const id = await placedOrder();
    const payments = new FakePaymentGateway();
    const pay = useCase(repo, outbox, payments);

    payments.unavailable = true;
    await expect(pay.execute({ orderId: id, actor, idempotencyKey: 'key-2' })).rejects.toThrow(
      PaymentUnavailableError,
    );
    payments.unavailable = false;
    await pay.execute({ orderId: id, actor, idempotencyKey: 'key-2' });

    expect(payments.charges).toHaveLength(1);
    expect((await repo.findById(id))!.status).toBe(OrderStatus.PAID);
  });

  it('cancelamento durante a cobrança espera e falha: o cliente nunca paga um pedido cancelado', async () => {
    const id = await placedOrder();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let charging!: () => void;
    const chargeStarted = new Promise<void>((resolve) => (charging = resolve));
    const slow = new FakePaymentGateway();
    const charge = slow.charge.bind(slow);
    slow.charge = async (input) => {
      charging();
      await gate;
      return charge(input);
    };

    const paying = useCase(repo, outbox, slow).execute({ orderId: id, actor });
    await chargeStarted;
    const cancelling = new CancelOrderUseCase(
      repo,
      outbox,
      new UuidV7Generator(),
      new FixedClock(),
      tx(),
    ).execute({
      orderId: id,
      actor,
    });
    // dá tempo de o cancelamento chegar ao UPDATE e ficar esperando a linha travada
    await new Promise((r) => setTimeout(r, 200));
    release();

    await paying;
    await expect(cancelling).rejects.toThrow(ConcurrencyError);
    expect((await repo.findById(id))!.status).toBe(OrderStatus.PAID);
    expect(slow.charges).toHaveLength(1);
  });
});
