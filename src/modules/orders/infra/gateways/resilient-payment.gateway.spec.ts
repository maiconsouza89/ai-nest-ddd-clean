import { FakeLogger } from '../../../../../test/fakes/fake-logger';
import { ChargeInput, PaymentGateway } from '../../application/ports/payment-gateway';
import { PaymentUnavailableError } from '../../domain/errors/payment-unavailable.error';
import { ResilientPaymentGateway } from './resilient-payment.gateway';

const input: ChargeInput = { orderId: 'o1', amountCents: 100, currency: 'BRL', idempotencyKey: 'pay:o1' };
const opts = { timeoutMs: 20, attempts: 3, baseDelayMs: 1 };

class Scripted implements PaymentGateway {
  calls: ChargeInput[] = [];
  constructor(private readonly steps: ('fail' | 'hang' | 'ok')[]) {}

  async charge(i: ChargeInput) {
    this.calls.push(i);
    const step = this.steps[this.calls.length - 1] ?? 'ok';
    if (step === 'fail') throw new Error('fornecedor');
    if (step === 'hang') return new Promise<never>(() => undefined);
    return { paymentId: 'pay_1' };
  }
}

const gateway = (inner: PaymentGateway, logger = new FakeLogger()) =>
  new ResilientPaymentGateway(inner, opts, logger);

describe('ResilientPaymentGateway', () => {
  it('repete a falha transitória reenviando a mesma chave de idempotência', async () => {
    const inner = new Scripted(['fail', 'ok']);
    await expect(gateway(inner).charge(input)).resolves.toEqual({ paymentId: 'pay_1' });
    expect(inner.calls).toEqual([input, input]);
  });

  it('chamada que não responde estoura o timeout e é repetida', async () => {
    const inner = new Scripted(['hang', 'ok']);
    await expect(gateway(inner).charge(input)).resolves.toEqual({ paymentId: 'pay_1' });
    expect(inner.calls).toHaveLength(2);
  });

  it('esgotadas as tentativas, vira PaymentUnavailableError', async () => {
    const inner = new Scripted(['fail', 'fail', 'fail']);
    await expect(gateway(inner).charge(input)).rejects.toThrow(PaymentUnavailableError);
    expect(inner.calls).toHaveLength(3);
  });

  it('registra a causa no log antes de devolver o erro genérico', async () => {
    const logger = new FakeLogger();
    await expect(gateway(new Scripted(['fail', 'fail', 'fail']), logger).charge(input)).rejects.toThrow(
      PaymentUnavailableError,
    );
    expect(logger.entries).toEqual([
      { level: 'error', fields: { orderId: 'o1', cause: 'fornecedor' }, message: 'payment provider call failed' },
    ]);
  });
});
