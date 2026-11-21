export const OrderStatus = { DRAFT: 'DRAFT', PLACED: 'PLACED', PAID: 'PAID' } as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
