export const OrderStatus = {
  DRAFT: 'DRAFT',
  PLACED: 'PLACED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Estados em que o pedido ainda não foi pago nem cancelado, e portanto pode expirar. */
export const EXPIRABLE_STATUSES: readonly OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PLACED];
