import { Logger } from '#shared/application/ports/logger';
import { ChargeInput, PaymentGateway } from '../../application/ports/payment-gateway.js';
import { PaymentUnavailableError } from '../../domain/errors/payment-unavailable.error.js';
import { retry } from '#shared/infra/resilience/retry';
import { withTimeout } from '#shared/infra/resilience/with-timeout';

export type ResilienceOptions = { timeoutMs: number; attempts: number; baseDelayMs: number };

/**
 * Timeout em toda chamada e retry com backoff. O retry é seguro porque `charge` sempre leva a chave de
 * idempotência: o fornecedor devolve o mesmo pagamento em vez de cobrar de novo.
 * Qualquer falha do fornecedor (inclusive timeout) vira PaymentUnavailableError.
 */
export class ResilientPaymentGateway implements PaymentGateway {
  constructor(
    private readonly inner: PaymentGateway,
    private readonly opts: ResilienceOptions,
    private readonly logger: Logger,
  ) {}

  async charge(input: ChargeInput) {
    try {
      return await retry(() => withTimeout(() => this.inner.charge(input), this.opts.timeoutMs), {
        attempts: this.opts.attempts,
        baseDelayMs: this.opts.baseDelayMs,
        shouldRetry: () => true,
      });
    } catch (error) {
      // a causa só aparece aqui: o cliente recebe a mensagem genérica
      this.logger.error(
        { orderId: input.orderId, cause: error instanceof Error ? error.message : String(error) },
        'payment provider call failed',
      );
      throw new PaymentUnavailableError();
    }
  }
}
