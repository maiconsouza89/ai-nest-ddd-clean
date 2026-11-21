// Evento público do orders (v1). Só primitivos; mudança que quebra vira OrderCancelledV2.
export type OrderCancelledV1 = {
  eventId: string;
  type: 'orders.order-cancelled';
  version: 1;
  occurredAt: string;
  payload: { orderId: string; customerId: string };
};
