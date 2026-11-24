import { describe, it, expect } from 'vitest';
import { NotOrderOwnerError } from '../../domain/errors/not-order-owner.error.js';
import { OrderNotFoundError } from '../../domain/errors/order-not-found.error.js';
import { OrderDetails, OrderQueries } from '../queries/order.queries.js';
import { GetOrderUseCase } from './get-order.use-case.js';

const order: OrderDetails = {
  id: 'o1',
  customerId: 'u1',
  status: 'DRAFT',
  items: [{ productId: 'p1', qty: 2, unitPriceCents: 150, currency: 'BRL' }],
  totalCents: 300,
  currency: 'BRL',
};

const queries = {
  getById: async (id: string) => (id === order.id ? order : null),
} as OrderQueries;
const getOrder = new GetOrderUseCase(queries);

describe('GetOrderUseCase', () => {
  it('devolve o pedido ao dono', async () => {
    expect(await getOrder.execute({ orderId: 'o1', actor: { id: 'u1', roles: [] } })).toEqual(
      order,
    );
  });

  it('um admin lê o pedido de outro cliente', async () => {
    await expect(
      getOrder.execute({ orderId: 'o1', actor: { id: 'a1', roles: ['admin'] } }),
    ).resolves.toEqual(order);
  });

  it('outro usuário não lê o pedido', async () => {
    await expect(
      getOrder.execute({ orderId: 'o1', actor: { id: 'u2', roles: [] } }),
    ).rejects.toThrow(NotOrderOwnerError);
  });

  it('pedido inexistente', async () => {
    await expect(
      getOrder.execute({ orderId: 'nope', actor: { id: 'u1', roles: [] } }),
    ).rejects.toThrow(OrderNotFoundError);
  });
});
