import { describe, it, expect } from 'vitest';
import { incompatibilities } from '#test/helpers/contract';
import { Order } from '../../domain/entities/order.entity.js';
import { Money } from '#shared/domain/money.vo';
import { orderCreatedV1Example } from '../../contracts/events/order-created.v1.example.js';
import { orderPlacedV1Example } from '../../contracts/events/order-placed.v1.example.js';
import { orderCancelledV1Example } from '../../contracts/events/order-cancelled.v1.example.js';
import { orderPaidV1Example } from '../../contracts/events/order-paid.v1.example.js';
import { toIntegrationEvent } from './to-integration-event.js';

// Lado de quem publica: o que o orders realmente gera precisa ser compatível com o exemplo do contrato.
describe('contrato dos eventos publicados pelo orders', () => {
  const meta = { eventId: 'e1', occurredAt: new Date('2026-01-01T12:00:00.000Z') };
  const newOrder = () => {
    const order = Order.create('o1', 'u1');
    order.addItem('p1', 2, Money.fromCents(1000));
    return order;
  };
  const placedOrder = () => {
    const order = newOrder();
    order.place();
    return order;
  };
  // eventos de um agregado já convertidos para o contrato público, na ordem em que foram anotados
  const published = (order: Order) =>
    order.pullDomainEvents().map((e) => toIntegrationEvent(e, meta));

  it('OrderCreated gera orders.order-created v1 compatível com o exemplo', () => {
    const [event] = published(newOrder());

    expect(incompatibilities(orderCreatedV1Example, event)).toEqual([]);
    expect(event).toMatchObject({
      type: orderCreatedV1Example.type,
      version: orderCreatedV1Example.version,
    });
  });

  it('OrderPlaced gera orders.order-placed v1 compatível com o exemplo', () => {
    const event = published(placedOrder()).at(-1);

    expect(incompatibilities(orderPlacedV1Example, event)).toEqual([]);
    expect(event).toMatchObject({
      type: orderPlacedV1Example.type,
      version: orderPlacedV1Example.version,
    });
  });

  it('OrderPaid gera orders.order-paid v1 compatível com o exemplo', () => {
    const order = placedOrder();
    order.pullDomainEvents();
    order.pay();

    const [event] = published(order);

    expect(incompatibilities(orderPaidV1Example, event)).toEqual([]);
    expect(event).toMatchObject({
      type: orderPaidV1Example.type,
      version: orderPaidV1Example.version,
    });
  });

  it('OrderCancelled gera orders.order-cancelled v1 compatível com o exemplo', () => {
    const order = placedOrder();
    order.pullDomainEvents();
    order.cancel();

    const [event] = published(order);

    expect(incompatibilities(orderCancelledV1Example, event)).toEqual([]);
    expect(event).toMatchObject({
      type: orderCancelledV1Example.type,
      version: orderCancelledV1Example.version,
    });
  });

  describe('o verificador de compatibilidade', () => {
    it('aceita campo a mais (mudança aditiva)', () => {
      expect(incompatibilities({ a: 1 }, { a: 2, extra: 'x' })).toEqual([]);
    });

    it('acusa campo removido, mudança de tipo e campo aninhado ausente', () => {
      expect(incompatibilities({ a: 1, p: { b: 'x' } }, { p: {} })).toEqual([
        '$.a: campo ausente',
        '$.p.b: campo ausente',
      ]);
      expect(incompatibilities({ a: 1 }, { a: '1' })).toEqual([
        '$.a: esperado number, veio string',
      ]);
    });
  });
});
