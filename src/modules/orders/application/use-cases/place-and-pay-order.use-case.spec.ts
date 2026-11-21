import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { Money } from '../../../../shared/domain/money.vo';
import { Order } from '../../domain/entities/order.entity';
import { NotOrderOwnerError } from '../../domain/errors/not-order-owner.error';
import { OrderNotFoundError } from '../../domain/errors/order-not-found.error';
import { OrderStatus } from '../../domain/value-objects/order-status.vo';
import { InMemoryOrderRepository } from '../../infra/database/in-memory/in-memory-order.repository';
import { PayOrderUseCase } from './pay-order.use-case';
import { PlaceOrderUseCase } from './place-order.use-case';

const owner = { id: 'u1', roles: [] };
const other = { id: 'u2', roles: [] };
const admin = { id: 'a1', roles: ['admin'] };

async function setup() {
  const repo = new InMemoryOrderRepository();
  const order = Order.create('o1', 'u1');
  order.addItem('p1', 1, Money.fromCents(100));
  await repo.save(order);
  const tx = new FakeTransactionManager();
  return { repo, tx, place: new PlaceOrderUseCase(repo, tx), pay: new PayOrderUseCase(repo, tx) };
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

  it('pedido inexistente lança OrderNotFoundError', async () => {
    const { pay } = await setup();
    await expect(pay.execute({ orderId: 'x', actor: owner })).rejects.toThrow(OrderNotFoundError);
  });
});
