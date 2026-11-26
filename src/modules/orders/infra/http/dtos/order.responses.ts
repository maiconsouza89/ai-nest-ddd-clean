export class CreatedOrderResponse {
  /** Id do pedido criado, em `DRAFT`. */
  id!: string;
}

export class OrderListItemResponse {
  id!: string;

  /** `DRAFT`, `PLACED`, `PAID` ou `CANCELLED`. */
  status!: string;

  /** Quantidade de linhas do pedido, sem somar as unidades. */
  itemCount!: number;

  /** Total do pedido, em centavos. */
  totalCents!: number;

  /** Código ISO 4217 da moeda. */
  currency!: string;

  createdAt!: Date;
}

export class OrderItemResponse {
  productId!: string;

  qty!: number;

  /** Preço da unidade no momento em que o item entrou no pedido, em centavos. */
  unitPriceCents!: number;

  /** Código ISO 4217 da moeda. */
  currency!: string;
}

export class OrderDetailsResponse {
  id!: string;

  /** Dono do pedido. */
  customerId!: string;

  /** `DRAFT`, `PLACED`, `PAID` ou `CANCELLED`. */
  status!: string;

  items!: OrderItemResponse[];

  /** Total do pedido, em centavos. */
  totalCents!: number;

  /** Código ISO 4217 da moeda. */
  currency!: string;
}
