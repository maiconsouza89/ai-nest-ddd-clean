import { FakeIdempotencyStore } from '../../../../../test/fakes/fake-idempotency-store';
import { FakeOutbox } from '../../../../../test/fakes/fake-outbox';
import { FakePaymentGateway } from '../../../../../test/fakes/fake-payment-gateway';
import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { FixedClock } from '../../../../../test/fakes/fixed-clock';
import { SequentialIdGenerator } from '../../../../../test/fakes/sequential-id-generator';
import { Money } from '../../../../shared/domain/money.vo';
import { Order } from '../../domain/entities/order.entity';
import { IdempotencyKeyReusedError } from '../../domain/errors/idempotency-key-reused.error';
import { InvalidIdempotencyKeyError } from '../../domain/errors/invalid-idempotency-key.error';
import { OrderNotPayableError } from '../../domain/errors/order-not-payable.error';
import { PaymentUnavailableError } from '../../domain/errors/payment-unavailable.error';
import { OrderStatus } from '../../domain/value-objects/order-status.vo';
import { InMemoryOrderRepository } from '../../infra/database/in-memory/in-memory-order.repository';
import { PayOrderUseCase } from './pay-order.use-case';

const owner = { id: 'u1', roles: [] };

async function setup() {
  const repo = new InMemoryOrderRepository();
  for (const id of ['o1', 'o2']) {
    const order = Order.create(id, 'u1');
    order.addItem('p1', 2, Money.fromCents(500));
    order.place();
    order.pullDomainEvents(); // o repositório em memória devolve a mesma instância; ver place-and-pay
    await repo.save(order);
  }
  const payments = new FakePaymentGateway();
  const outbox = new FakeOutbox();
  const pay = new PayOrderUseCase(
    repo,
    outbox,
    new SequentialIdGenerator('evt'),
    new FixedClock(),
    new FakeTransactionManager(),
    payments,
    new FakeIdempotencyStore(),
    60_000,
  );
  return { repo, payments, outbox, pay };
}

describe('PayOrderUseCase: cobrança', () => {
  it('cobra o total do pedido com a chave de idempotência derivada do pedido', async () => {
    const { payments, pay } = await setup();
    await pay.execute({ orderId: 'o1', actor: owner });
    expect(payments.charges).toEqual([
      { orderId: 'o1', amountCents: 1000, currency: 'BRL', idempotencyKey: 'pay:o1' },
    ]);
  });

  it('fornecedor fora do ar: o erro sobe e nada vai para a outbox', async () => {
    const { payments, outbox, pay } = await setup();
    payments.unavailable = true;
    await expect(pay.execute({ orderId: 'o1', actor: owner })).rejects.toThrow(
      PaymentUnavailableError,
    );
    expect(outbox.events).toEqual([]);
  });

  it('pedido que não pode ser pago não chega a cobrar', async () => {
    const { repo, payments, pay } = await setup();
    const draft = Order.create('o3', 'u1');
    await repo.save(draft);
    await expect(pay.execute({ orderId: 'o3', actor: owner })).rejects.toThrow(
      OrderNotPayableError,
    );
    expect(payments.charges).toEqual([]);
  });
});

describe('PayOrderUseCase: Idempotency-Key', () => {
  it('repetir com a mesma chave não cobra nem publica de novo e não falha', async () => {
    const { payments, outbox, pay } = await setup();
    await pay.execute({ orderId: 'o1', actor: owner, idempotencyKey: 'k1' });
    await pay.execute({ orderId: 'o1', actor: owner, idempotencyKey: 'k1' });
    expect(payments.charges).toHaveLength(1);
    expect(outbox.events).toHaveLength(1);
  });

  it('a mesma chave em outro pedido é rejeitada', async () => {
    const { payments, pay } = await setup();
    await pay.execute({ orderId: 'o1', actor: owner, idempotencyKey: 'k1' });
    await expect(
      pay.execute({ orderId: 'o2', actor: owner, idempotencyKey: 'k1' }),
    ).rejects.toThrow(IdempotencyKeyReusedError);
    expect(payments.charges).toHaveLength(1);
  });

  it('a chave vale por usuário', async () => {
    const { pay } = await setup();
    await pay.execute({ orderId: 'o1', actor: owner, idempotencyKey: 'k1' });
    // outro usuário com a mesma chave não enxerga a do primeiro (e cai na regra de posse)
    await expect(
      pay.execute({ orderId: 'o2', actor: { id: 'u2', roles: [] }, idempotencyKey: 'k1' }),
    ).rejects.not.toThrow(IdempotencyKeyReusedError);
  });

  it('falha na cobrança não queima a chave: dá para tentar de novo', async () => {
    const { repo, payments, pay } = await setup();
    payments.unavailable = true;
    await expect(
      pay.execute({ orderId: 'o1', actor: owner, idempotencyKey: 'k1' }),
    ).rejects.toThrow(PaymentUnavailableError);
    payments.unavailable = false;
    await pay.execute({ orderId: 'o1', actor: owner, idempotencyKey: 'k1' });
    expect((await repo.findById('o1'))!.status).toBe(OrderStatus.PAID);
  });

  it.each(['', 'x'.repeat(256)])('rejeita chave inválida (%#)', async (idempotencyKey) => {
    const { pay } = await setup();
    await expect(pay.execute({ orderId: 'o1', actor: owner, idempotencyKey })).rejects.toThrow(
      InvalidIdempotencyKeyError,
    );
  });
});
