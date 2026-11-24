import { Page, PageRequest } from '#shared/application/page';

export type OrderListItem = {
  id: string;
  status: string;
  itemCount: number;
  totalCents: number;
  currency: string;
  createdAt: Date;
};

export type OrderDetails = {
  id: string;
  customerId: string;
  status: string;
  items: { productId: string; qty: number; unitPriceCents: number; currency: string }[];
  totalCents: number;
  currency: string;
};

// Leitura (CQRS leve): devolve DTO pronto, sem montar agregados.
export abstract class OrderQueries {
  abstract listByCustomer(customerId: string, page: PageRequest): Promise<Page<OrderListItem>>;
  /** `null` se o pedido não existe. Quem chama aplica a regra de acesso. */
  abstract getById(orderId: string): Promise<OrderDetails | null>;
}
