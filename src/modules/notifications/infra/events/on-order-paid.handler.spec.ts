import { FakeLogger } from '../../../../../test/fakes/fake-logger';
import { FakeProcessedEvents } from '../../../../../test/fakes/fake-processed-events';
import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { IdempotentConsumer } from '../../../../shared/application/idempotent-consumer';
import { orderPaidV1Example } from '../../../orders/contracts/events/order-paid.v1.example';
import { Email, EmailSender } from '../../application/ports/email-sender';
import { RecipientDirectory } from '../../application/ports/recipient-directory';
import { SendOrderPaidEmailUseCase } from '../../application/use-cases/send-order-paid-email.use-case';
import { OnOrderPaidHandler } from './on-order-paid.handler';

class FakeEmailSender implements EmailSender {
  readonly sent: Email[] = [];
  async send(email: Email) {
    this.sent.push(email);
  }
}

// Lado de quem consome: o handler precisa entender o exemplo versionado do contrato do orders.
describe('OnOrderPaidHandler', () => {
  const setup = (known = true) => {
    const emails = new FakeEmailSender();
    const logger = new FakeLogger();
    const recipients: RecipientDirectory = {
      emailOf: async (id) => (known && id === orderPaidV1Example.payload.customerId ? 'ana@example.com' : null),
    };
    const handler = new OnOrderPaidHandler(
      new IdempotentConsumer(new FakeTransactionManager(), new FakeProcessedEvents(), logger),
      new SendOrderPaidEmailUseCase(recipients, emails, logger),
    );
    return { emails, logger, handler };
  };

  it('envia o e-mail de confirmação ao cliente do pedido', async () => {
    const { emails, handler } = setup();
    await handler.handle(orderPaidV1Example);
    expect(emails.sent).toHaveLength(1);
    expect(emails.sent[0].to).toBe('ana@example.com');
    expect(emails.sent[0].subject).toContain(orderPaidV1Example.payload.orderId);
  });

  it('o mesmo evento entregue duas vezes envia um e-mail só', async () => {
    const { emails, handler } = setup();
    await handler.handle(orderPaidV1Example);
    await handler.handle(orderPaidV1Example);
    expect(emails.sent).toHaveLength(1);
  });

  it('cliente inexistente: não envia, avisa no log e não falha (repetir não adiantaria)', async () => {
    const { emails, logger, handler } = setup(false);
    await expect(handler.handle(orderPaidV1Example)).resolves.toBeUndefined();
    expect(emails.sent).toEqual([]);
    expect(logger.entries.some((e) => e.level === 'warn')).toBe(true);
  });
});
