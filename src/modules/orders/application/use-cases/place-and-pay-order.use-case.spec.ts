import { FakeOutbox } from '../../../../../test/fakes/fake-outbox';
import { FixedClock } from '../../../../../test/fakes/fixed-clock';
import { SequentialIdGenerator } from '../../../../../test/fakes/sequential-id-generator';
import { FakeStockGateway } from '../../../../../test/fakes/fake-stock-gateway';
import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { Money } from '../../../../shared/domain/money.vo';
import { Order } from '../../domain/entities/order.entity';
import { InsufficientStockError } from '../../domain/errors/insufficient-stock.error';
import { NotOrderOwnerError } from '../../domain/errors/not-order-owner.error';
import { OrderNotFoundError } from '../../domain/errors/order-not-found.error';
import { OrderStatus } from '../../domain/value-objects/order-status.vo';
import { InMemoryOrderRepository } from '../../infra/database/in-memory/in-memory-order.repository';
import { PayOrderUseCase } from './pay-order.use-case';
import { PlaceOrderUseCase } from './place-order.use-case';

const owner = { id: 'u1', roles: [] };
const other = { id: 'u2', roles: [] };
const admin = { id: 'a1', roles: ['admin'] };

async function setup(outOfStock = false) {
  const repo = new InMemoryOrderRepository();
  const order = Order.create('o1', 'u1');
  order.addItem('p1', 1, Money.fromCents(100));
  await repo.save(order);
  const tx = new FakeTransactionManager();
  const stock = new FakeStockGateway(outOfStock);
  const outbox = new FakeOutbox();
  return {
    repo,
    tx,
    stock,
    outbox,
    place: new PlaceOrderUseCase(repo, stock, tx),
    pay: new PayOrderUseCase(repo, outbox, new SequentialIdGenerator('evt'), new FixedClock(), tx),
  };
}

describe('PlaceOrderUseCase', () => {
  it('o dono fecha o pedido', async () => {
    const { repo, place } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    expect((await repo.findById('o1'))!.status).toBe(OrderStatus.PLACED);
  });

  it('outro usuário recebe NotOrderOwnerError', async () => {
    const { place } = await setup();
    await expect(place.execute({ orderId: 'o1', actor: other })).rejects.toThrow(NotOrderOwnerError);
  });

  it('admin consegue fechar', async () => {
    const { repo, place } = await setup();
    await place.execute({ orderId: 'o1', actor: admin });
    expect((await repo.findById('o1'))!.status).toBe(OrderStatus.PLACED);
  });

  it('reserva o estoque dos itens usando o id do pedido', async () => {
    const { stock, place } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    expect(stock.reservations).toEqual([{ orderId: 'o1', items: [{ productId: 'p1', qty: 1 }] }]);
  });

  it('sem estoque, lança InsufficientStockError e o pedido continua rascunho', async () => {
    const { repo, place } = await setup(true);
    await expect(place.execute({ orderId: 'o1', actor: owner })).rejects.toThrow(
      InsufficientStockError,
    );
    expect((await repo.findById('o1'))!.status).toBe(OrderStatus.DRAFT);
  });

  it('carrega, altera e salva dentro de uma transação', async () => {
    const { tx, place } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    expect(tx.runs).toBe(1);
  });

  it('pedido inexistente lança OrderNotFoundError', async () => {
    const { place } = await setup();
    await expect(place.execute({ orderId: 'x', actor: owner })).rejects.toThrow(OrderNotFoundError);
  });
});

describe('PayOrderUseCase', () => {
  it('o dono paga um pedido fechado', async () => {
    const { repo, place, pay } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    await pay.execute({ orderId: 'o1', actor: owner });
    expect((await repo.findById('o1'))!.status).toBe(OrderStatus.PAID);
  });

  it('outro usuário recebe NotOrderOwnerError', async () => {
    const { place, pay } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    await expect(pay.execute({ orderId: 'o1', actor: other })).rejects.toThrow(NotOrderOwnerError);
  });

  it('admin consegue pagar', async () => {
    const { repo, place, pay } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    await pay.execute({ orderId: 'o1', actor: admin });
    expect((await repo.findById('o1'))!.status).toBe(OrderStatus.PAID);
  });

  it('pagar grava o contrato OrderPaidV1 na outbox', async () => {
    const { place, pay, outbox } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    await pay.execute({ orderId: 'o1', actor: owner });

    expect(outbox.events).toEqual([
      {
        eventId: 'evt-1',
        type: 'orders.order-paid',
        version: 1,
        occurredAt: '2026-01-01T12:00:00.000Z',
        payload: { orderId: 'o1', customerId: 'u1', totalCents: 100, currency: 'BRL' },
      },
    ]);
  });

  it('pagamento recusado não grava evento', async () => {
    const { place, pay, outbox } = await setup();
    await place.execute({ orderId: 'o1', actor: owner });
    await expect(pay.execute({ orderId: 'o1', actor: other })).rejects.toThrow(NotOrderOwnerError);
    expect(outbox.events).toEqual([]);
  });

  it('pedido inexistente lança OrderNotFoundError', async () => {
    const { pay } = await setup();
    await expect(pay.execute({ orderId: 'x', actor: owner })).rejects.toThrow(OrderNotFoundError);
  });
});
