import { describe, it, expect } from 'vitest';
import { FakeEmailSender } from '#test/fakes/fake-email-sender';
import { FakeLogger } from '#test/fakes/fake-logger';
import { FakeProcessedEvents } from '#test/fakes/fake-processed-events';
import { FakeTransactionManager } from '#test/fakes/fake-transaction-manager';
import { IdempotentConsumer } from '#shared/application/idempotent-consumer';
import { emailVerifiedV1Example } from '#modules/identity/contracts/events/email-verified.v1.example';
import { verificationCodeIssuedV1Example } from '#modules/identity/contracts/events/verification-code-issued.v1.example';
import { SendVerificationCodeEmailUseCase } from '../../application/use-cases/send-verification-code-email.use-case.js';
import { SendWelcomeEmailUseCase } from '../../application/use-cases/send-welcome-email.use-case.js';
import { OnEmailVerifiedHandler } from './on-email-verified.handler.js';
import { OnVerificationCodeIssuedHandler } from './on-verification-code-issued.handler.js';

const consumer = () =>
  new IdempotentConsumer(new FakeTransactionManager(), new FakeProcessedEvents(), new FakeLogger());

// Lado de quem consome: os handlers precisam entender os exemplos versionados do identity.
describe('OnVerificationCodeIssuedHandler', () => {
  const setup = () => {
    const emails = new FakeEmailSender();
    const handler = new OnVerificationCodeIssuedHandler(
      consumer(),
      new SendVerificationCodeEmailUseCase(emails),
    );
    return { emails, handler };
  };

  it('envia o código ao e-mail do payload, com a validade contada da emissão', async () => {
    const { emails, handler } = setup();
    await handler.handle(verificationCodeIssuedV1Example);
    const { email, code } = verificationCodeIssuedV1Example.payload;
    expect(emails.sent).toEqual([
      expect.objectContaining({ to: email, subject: 'Seu código de verificação' }),
    ]);
    expect(emails.sent[0].body).toContain(code);
    expect(emails.sent[0].body).toContain('10 minutos');
  });

  it('o mesmo evento entregue duas vezes envia um e-mail só', async () => {
    const { emails, handler } = setup();
    await handler.handle(verificationCodeIssuedV1Example);
    await handler.handle(verificationCodeIssuedV1Example);
    expect(emails.sent).toHaveLength(1);
  });
});

describe('OnEmailVerifiedHandler', () => {
  it('envia as boas-vindas ao e-mail do payload', async () => {
    const emails = new FakeEmailSender();
    const handler = new OnEmailVerifiedHandler(consumer(), new SendWelcomeEmailUseCase(emails));

    await handler.handle(emailVerifiedV1Example);

    const { email, name } = emailVerifiedV1Example.payload;
    expect(emails.sent).toEqual([
      expect.objectContaining({ to: email, subject: `Boas-vindas, ${name}` }),
    ]);
  });
});
