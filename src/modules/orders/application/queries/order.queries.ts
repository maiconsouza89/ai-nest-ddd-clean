import { Page, PageRequest } from '#shared/application/page';

export type OrderListItem = {
  id: string;
  status: string;
  itemCount: number;
  totalCents: number;
  currency: string;
  createdAt: Date;
};

// Leitura (CQRS leve): devolve DTO pronto, sem montar agregados.
export abstract class OrderQueries {
  abstract listByCustomer(customerId: string, page: PageRequest): Promise<Page<OrderListItem>>;
}
