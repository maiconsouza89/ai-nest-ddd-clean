export type CreateOrderInput = {
  customerId: string;
  items: { productId: string; qty: number }[];
};
