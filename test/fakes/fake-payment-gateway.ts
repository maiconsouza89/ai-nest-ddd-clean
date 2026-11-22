import { ChargeInput, PaymentGateway } from '#modules/orders/application/ports/payment-gateway';
import { PaymentUnavailableError } from '#modules/orders/domain/errors/payment-unavailable.error';

export class FakePaymentGateway implements PaymentGateway {
  readonly charges: ChargeInput[] = [];
  /** Liga para simular fornecedor fora do ar. */
  unavailable = false;

  async charge(input: ChargeInput) {
    if (this.unavailable) throw new PaymentUnavailableError();
    this.charges.push(input);
    return { paymentId: `pay-${this.charges.length}` };
  }
}
