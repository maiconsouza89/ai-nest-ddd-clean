import { incompatibilities } from '../../../../../test/helpers/contract';
import { Order } from '../../domain/entities/order.entity';
import { Money } from '../../../../shared/domain/money.vo';
import { orderCancelledV1Example } from '../../contracts/events/order-cancelled.v1.example';
import { orderPaidV1Example } from '../../contracts/events/order-paid.v1.example';
import { toIntegrationEvent } from './to-integration-event';

// Lado de quem publica: o que o orders realmente gera precisa ser compatível com o exemplo do contrato.
describe('contrato dos eventos publicados pelo orders', () => {
  const meta = { eventId: 'e1', occurredAt: new Date('2026-01-01T12:00:00.000Z') };
  const placedOrder = () => {
    const order = Order.create('o1', 'u1');
    order.addItem('p1', 2, Money.fromCents(1000));
    order.place();
    return order;
  };

  it('OrderPaid gera orders.order-paid v1 compatível com o exemplo', () => {
    const order = placedOrder();
    order.pay();

    const [event] = order.pullDomainEvents().map((e) => toIntegrationEvent(e, meta));

    expect(incompatibilities(orderPaidV1Example, event)).toEqual([]);
    expect(event).toMatchObject({ type: orderPaidV1Example.type, version: orderPaidV1Example.version });
  });

  it('OrderCancelled gera orders.order-cancelled v1 compatível com o exemplo', () => {
    const order = placedOrder();
    order.cancel();

    const [event] = order.pullDomainEvents().map((e) => toIntegrationEvent(e, meta));

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
      expect(incompatibilities({ a: 1 }, { a: '1' })).toEqual(['$.a: esperado number, veio string']);
    });
  });
});
