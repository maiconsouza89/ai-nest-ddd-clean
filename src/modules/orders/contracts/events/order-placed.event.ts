// Evento público do orders (v1). Só primitivos; mudança que quebra vira OrderPlacedV2.
export type OrderPlacedV1 = {
  eventId: string;
  type: 'orders.order-placed';
  version: 1;
  occurredAt: string;
  payload: { orderId: string; customerId: string };
};
