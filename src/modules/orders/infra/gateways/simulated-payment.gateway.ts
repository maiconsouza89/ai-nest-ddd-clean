import { createHash } from 'node:crypto';
import { ChargeInput, PaymentGateway } from '../../application/ports/payment-gateway';

/**
 * Fornecedor de pagamento simulado, para desenvolvimento: aprova tudo e deriva o `paymentId` da chave
 * de idempotência, como um fornecedor real faz (mesma chave, mesmo pagamento). Ao integrar um fornecedor
 * de verdade, troque só este adapter: ele deve traduzir os erros do fornecedor para PaymentUnavailableError.
 */
export class SimulatedPaymentGateway implements PaymentGateway {
  async charge({ idempotencyKey }: ChargeInput) {
    const digest = createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16);
    return { paymentId: `pay_${digest}` };
  }
}
