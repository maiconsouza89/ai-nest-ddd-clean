export type ChargeInput = {
  orderId: string;
  amountCents: number;
  currency: string;
  /** O fornecedor devolve o mesmo resultado para a mesma chave: repetir a chamada não cobra de novo. */
  idempotencyKey: string;
};

export abstract class PaymentGateway {
  /** Lança PaymentUnavailableError quando o fornecedor falha ou estoura o tempo. */
  abstract charge(input: ChargeInput): Promise<{ paymentId: string }>;
}
