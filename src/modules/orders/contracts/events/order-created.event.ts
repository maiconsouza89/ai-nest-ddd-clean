// Evento público do orders (v1). Só primitivos; mudança que quebra vira OrderCreatedV2.
export type OrderCreatedV1 = {
  eventId: string;
  type: 'orders.order-created';
  version: 1;
  occurredAt: string;
  payload: { orderId: string; customerId: string };
};
