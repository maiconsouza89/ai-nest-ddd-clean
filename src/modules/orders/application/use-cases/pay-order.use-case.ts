import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Outbox } from '#shared/application/ports/outbox';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { InvalidIdempotencyKeyError } from '../../domain/errors/invalid-idempotency-key.error.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { PayOrderInput } from '../dtos/pay-order.input.js';
import { publishOrderEvents } from '../events/publish-order-events.js';
import { loadOwnedOrder } from '../order-access.js';
import { IdempotencyStore } from '../ports/idempotency-store.js';
import { PaymentGateway } from '../ports/payment-gateway.js';

const MAX_KEY_LENGTH = 255;

export class PayOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
    private readonly payments: PaymentGateway,
    private readonly idempotency: IdempotencyStore,
    private readonly keyTtlMs: number,
  ) {}

  async execute({ orderId, actor, idempotencyKey }: PayOrderInput) {
    if (
      idempotencyKey !== undefined &&
      (idempotencyKey === '' || idempotencyKey.length > MAX_KEY_LENGTH)
    ) {
      throw new InvalidIdempotencyKeyError();
    }

    // o mesmo valor serve de impressão digital da requisição e de chave de idempotência no fornecedor
    const paymentKey = `pay:${orderId}`;

    // chave, pedido e eventos na mesma transação: ou grava tudo, ou nada
    await this.tx.run(async () => {
      if (idempotencyKey !== undefined) {
        const now = this.clock.now();
        const claim = await this.idempotency.claim({
          key: idempotencyKey,
          actorId: actor.id,
          fingerprint: paymentKey,
          expiresAt: new Date(now.getTime() + this.keyTtlMs),
          now,
        });
        // mesma requisição já concluída: a resposta é a mesma e nada é cobrado de novo
        if (claim === 'replay') return;
      }

      const order = await loadOwnedOrder(this.repo, orderId, actor, { lock: true });
      order.pay(); // valida o estado antes de cobrar
      // A linha do pedido está travada: cancelamento ou expiração concorrentes esperam e falham, então
      // não há cobrança de pedido que mudou no meio. Se o commit falhar depois da cobrança, o retry reenvia a mesma chave e o fornecedor não cobra de novo.
      const total = order.total;
      await this.payments.charge({
        orderId: order.id,
        amountCents: total.cents,
        currency: total.currency,
        idempotencyKey: paymentKey,
      });
      await this.repo.save(order);
      await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
    });
  }
}
