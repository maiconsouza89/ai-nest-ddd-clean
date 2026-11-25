import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakeEmailSender } from '#test/fakes/fake-email-sender';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startOutboxDatabase } from '#test/helpers/outbox-database';
import { IdempotentConsumer } from '#shared/application/idempotent-consumer';
import { TypeOrmTransactionManager } from '#shared/infra/database/typeorm-transaction-manager';
import { TypeOrmProcessedEvents } from '#shared/infra/outbox/typeorm-processed-events';
import { emailVerifiedV1Example } from '#modules/identity/contracts/events/email-verified.v1.example';
import { verificationCodeIssuedV1Example } from '#modules/identity/contracts/events/verification-code-issued.v1.example';
import { SendVerificationCodeEmailUseCase } from '../../application/use-cases/send-verification-code-email.use-case.js';
import { SendWelcomeEmailUseCase } from '../../application/use-cases/send-welcome-email.use-case.js';
import { OnEmailVerifiedHandler } from './on-email-verified.handler.js';
import { OnVerificationCodeIssuedHandler } from './on-verification-code-issued.handler.js';

describe('E-mails do identity com a marca de processado no Postgres (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let consumer: IdempotentConsumer;

  beforeAll(async () => {
    ({ ds, stop } = await startOutboxDatabase());
    consumer = new IdempotentConsumer(
      new TypeOrmTransactionManager(ds),
      new TypeOrmProcessedEvents(ds),
      new FakeLogger(),
    );
  });

  afterAll(() => stop?.());

  it('a mesma entrega do código duas vezes envia um e-mail só', async () => {
    const emails = new FakeEmailSender();
    const handler = new OnVerificationCodeIssuedHandler(
      consumer,
      new SendVerificationCodeEmailUseCase(emails),
    );

    await handler.handle(verificationCodeIssuedV1Example);
    await handler.handle(verificationCodeIssuedV1Example);

    expect(emails.sent).toHaveLength(1);
  });

  it('a mesma entrega das boas-vindas duas vezes envia um e-mail só', async () => {
    const emails = new FakeEmailSender();
    const handler = new OnEmailVerifiedHandler(consumer, new SendWelcomeEmailUseCase(emails));

    await handler.handle(emailVerifiedV1Example);
    await handler.handle(emailVerifiedV1Example);

    expect(emails.sent).toHaveLength(1);
  });
});
