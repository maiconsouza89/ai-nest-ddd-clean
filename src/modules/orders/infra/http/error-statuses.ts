/**
 * Status HTTP de cada código de erro do orders. O `ProblemDetailsFilter` do shared monta a resposta, e
 * os códigos do shared (`CONCURRENCY_CONFLICT` e os do `Money`) o shared já registra.
 */
export const ORDERS_ERROR_STATUSES = {
  ORDER_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  NOT_ORDER_OWNER: 403,
  ORDER_ALREADY_PAID: 409,
  ORDER_NOT_EDITABLE: 409,
  ORDER_NOT_PAYABLE: 409,
  ORDER_NOT_CANCELLABLE: 409,
  INSUFFICIENT_STOCK: 409,
  EMPTY_ORDER: 422,
  INVALID_QUANTITY: 422,
  IDEMPOTENCY_KEY_REUSED: 422,
  INVALID_IDEMPOTENCY_KEY: 400,
  PAYMENT_UNAVAILABLE: 503,
} satisfies Record<string, number>;
