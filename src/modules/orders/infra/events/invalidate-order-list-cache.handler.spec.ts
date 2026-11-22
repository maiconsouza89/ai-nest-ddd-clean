import { describe, it, expect, vi } from 'vitest';
import { orderCancelledV1Example } from '../../contracts/events/order-cancelled.v1.example.js';
import { orderCreatedV1Example } from '../../contracts/events/order-created.v1.example.js';
import { orderPaidV1Example } from '../../contracts/events/order-paid.v1.example.js';
import { orderPlacedV1Example } from '../../contracts/events/order-placed.v1.example.js';
import { CachedOrderQueries } from '../cache/cached-order.queries.js';
import { InvalidateOrderListCacheHandler } from './invalidate-order-list-cache.handler.js';

// Lado de quem consome: o handler precisa entender os exemplos versionados dos contratos do orders.
describe('InvalidateOrderListCacheHandler', () => {
  it.each([
    ['orders.order-created', orderCreatedV1Example],
    ['orders.order-placed', orderPlacedV1Example],
    ['orders.order-paid', orderPaidV1Example],
    ['orders.order-cancelled', orderCancelledV1Example],
  ])('%s invalida a listagem do cliente do evento', async (_type, example) => {
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const handler = new InvalidateOrderListCacheHandler({
      invalidate,
    } as unknown as CachedOrderQueries);

    await handler.onOrderListChanged(example);

    expect(invalidate).toHaveBeenCalledWith(example.payload.customerId);
  });
});
