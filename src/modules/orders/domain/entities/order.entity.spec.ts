import { describe, it, expect } from 'vitest';
import { Money } from '#shared/domain/money.vo';
import { EmptyOrderError } from '../errors/empty-order.error.js';
import { OrderCancelled } from '../events/order-cancelled.event.js';
import { OrderCreated } from '../events/order-created.event.js';
import { OrderPaid } from '../events/order-paid.event.js';
import { OrderPlaced } from '../events/order-placed.event.js';
import { OrderAlreadyPaidError } from '../errors/order-already-paid.error.js';
import { OrderNotCancellableError } from '../errors/order-not-cancellable.error.js';
import { OrderNotEditableError } from '../errors/order-not-editable.error.js';
import { OrderNotPayableError } from '../errors/order-not-payable.error.js';
import { OrderStatus } from '../value-objects/order-status.vo.js';
import { Order } from './order.entity.js';

const price = (c: number) => Money.fromCents(c);

describe('Order', () => {
  const draft = () => Order.create('o1', 'u1');
  const placed = () => {
    const o = draft();
    o.addItem('p1', 1, price(100));
    o.place();
    return o;
  };

  it('nasce em rascunho e vazio', () => {
    const o = draft();
    expect(o.status).toBe(OrderStatus.DRAFT);
    expect(o.items).toHaveLength(0);
  });

  it('adicionar o mesmo produto soma a quantidade', () => {
    const o = draft();
    o.addItem('p1', 1, price(100));
    o.addItem('p1', 2, price(100));
    expect(o.items).toHaveLength(1);
    expect(o.items[0].qty).toBe(3);
  });

  it('calcula o total', () => {
    const o = draft();
    o.addItem('p1', 2, price(100));
    o.addItem('p2', 1, price(50));
    expect(o.total.cents).toBe(250);
  });

  it('não edita depois de fechado', () => {
    expect(() => placed().addItem('p2', 1, price(10))).toThrow(OrderNotEditableError);
  });

  it('não fecha vazio', () => {
    expect(() => draft().place()).toThrow(EmptyOrderError);
  });

  it('não paga rascunho', () => {
    expect(() => draft().pay()).toThrow(OrderNotPayableError);
  });

  it('paga pedido fechado e não paga duas vezes', () => {
    const o = placed();
    o.pay();
    expect(o.status).toBe(OrderStatus.PAID);
    expect(() => o.pay()).toThrow(OrderAlreadyPaidError);
  });

  it('pay() anota OrderPaid, que sai uma vez só em pullDomainEvents()', () => {
    const o = placed();
    o.pullDomainEvents(); // descarta OrderCreated e OrderPlaced
    o.pay();

    expect(o.pullDomainEvents()).toEqual([new OrderPaid('o1', 'u1', 100, 'BRL')]);
    expect(o.pullDomainEvents()).toEqual([]);
  });

  it('create() anota OrderCreated e adicionar item não anota nada', () => {
    const o = draft();
    o.addItem('p1', 1, price(100));

    expect(o.pullDomainEvents()).toEqual([new OrderCreated('o1', 'u1')]);
  });

  it('restore() não anota evento: recarregar um pedido não é um fato novo', () => {
    const o = Order.restore({
      id: 'o1',
      customerId: 'u1',
      items: [],
      status: OrderStatus.DRAFT,
      version: 3,
    });

    expect(o.pullDomainEvents()).toEqual([]);
  });

  it('place() anota OrderPlaced, depois de OrderCreated', () => {
    expect(placed().pullDomainEvents()).toEqual([
      new OrderCreated('o1', 'u1'),
      new OrderPlaced('o1', 'u1'),
    ]);
  });

  it('place() com falha não anota OrderPlaced', () => {
    const o = draft();
    o.pullDomainEvents();
    expect(() => o.place()).toThrow(EmptyOrderError);
    expect(o.pullDomainEvents()).toEqual([]);
  });

  it('pagar com falha não registra evento', () => {
    const o = draft();
    o.pullDomainEvents();
    expect(() => o.pay()).toThrow(OrderNotPayableError);
    expect(o.pullDomainEvents()).toEqual([]);
  });

  it.each([
    ['rascunho', draft],
    ['fechado', placed],
  ])('cancela pedido %s e registra OrderCancelled', (_name, make) => {
    const o = make();
    o.pullDomainEvents();
    o.cancel();

    expect(o.status).toBe(OrderStatus.CANCELLED);
    expect(o.pullDomainEvents()).toEqual([new OrderCancelled('o1', 'u1')]);
  });

  it('não cancela pedido pago nem cancelado, e a falha não registra evento', () => {
    const paid = placed();
    paid.pay();
    paid.pullDomainEvents();
    expect(() => paid.cancel()).toThrow(OrderNotCancellableError);
    expect(paid.pullDomainEvents()).toEqual([]);

    const cancelled = draft();
    cancelled.cancel();
    expect(() => cancelled.cancel()).toThrow(OrderNotCancellableError);
  });

  it('pedido cancelado não pode ser fechado nem pago', () => {
    const o = draft();
    o.addItem('p1', 1, price(100));
    o.cancel();
    expect(() => o.place()).toThrow(OrderNotEditableError);
    expect(() => o.pay()).toThrow(OrderNotPayableError);
  });

  it('não expõe a lista interna de itens', () => {
    const o = draft();
    (o.items as unknown[]).push('x');
    expect(o.items).toHaveLength(0);
  });

  it('informa o dono', () => {
    expect(draft().isOwnedBy('u1')).toBe(true);
    expect(draft().isOwnedBy('u2')).toBe(false);
  });
});
