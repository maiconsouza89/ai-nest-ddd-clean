// Evento público do orders (v1). Só primitivos; mudança que quebra vira OrderPaidV2.
export type OrderPaidV1 = {
  eventId: string;
  type: 'orders.order-paid';
  version: 1;
  occurredAt: string;
  payload: { orderId: string; customerId: string; totalCents: number; currency: string };
};
