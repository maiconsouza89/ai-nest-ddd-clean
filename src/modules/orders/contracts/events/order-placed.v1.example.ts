import { OrderPlacedV1 } from './order-placed.event.js';

// Exemplo versionado do contrato (regras de versão em order-paid.v1.example.ts).
export const orderPlacedV1Example: OrderPlacedV1 = {
  eventId: '0197a1b2-0000-7000-8000-000000000004',
  type: 'orders.order-placed',
  version: 1,
  occurredAt: '2026-01-01T11:55:00.000Z',
  payload: {
    orderId: '0197a1b2-0000-7000-8000-0000000000a1',
    customerId: '0197a1b2-0000-7000-8000-0000000000c1',
  },
};
