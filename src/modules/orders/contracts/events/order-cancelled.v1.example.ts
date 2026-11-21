import { OrderCancelledV1 } from './order-cancelled.event';

// Exemplo versionado do contrato (regras de versão em order-paid.v1.example.ts).
export const orderCancelledV1Example: OrderCancelledV1 = {
  eventId: '0197a1b2-0000-7000-8000-000000000002',
  type: 'orders.order-cancelled',
  version: 1,
  occurredAt: '2026-01-01T12:05:00.000Z',
  payload: {
    orderId: '0197a1b2-0000-7000-8000-0000000000a1',
    customerId: '0197a1b2-0000-7000-8000-0000000000c1',
  },
};
