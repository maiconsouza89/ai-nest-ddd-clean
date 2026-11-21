import { Money } from '../../../../shared/domain/money.vo';
import { EmptyOrderError } from '../errors/empty-order.error';
import { OrderAlreadyPaidError } from '../errors/order-already-paid.error';
import { OrderNotEditableError } from '../errors/order-not-editable.error';
import { OrderNotPayableError } from '../errors/order-not-payable.error';
import { OrderStatus } from '../value-objects/order-status.vo';
import { Order } from './order.entity';

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
