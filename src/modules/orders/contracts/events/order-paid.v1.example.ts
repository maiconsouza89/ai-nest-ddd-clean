import { OrderPaidV1 } from './order-paid.event.js';

// Exemplo versionado do contrato. Quem publica gera algo compatível com ele e quem consome entende ele.
// Campo novo opcional: mesma versão. Campo removido, renomeado ou com outro tipo: crie OrderPaidV2.
export const orderPaidV1Example: OrderPaidV1 = {
  eventId: '0197a1b2-0000-7000-8000-000000000001',
  type: 'orders.order-paid',
  version: 1,
  occurredAt: '2026-01-01T12:00:00.000Z',
  payload: {
    orderId: '0197a1b2-0000-7000-8000-0000000000a1',
    customerId: '0197a1b2-0000-7000-8000-0000000000c1',
    totalCents: 2000,
    currency: 'BRL',
  },
};
