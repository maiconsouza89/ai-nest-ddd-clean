import { describe, it, expect } from 'vitest';
import { FakeOutbox } from '#test/fakes/fake-outbox';
import { FakeVerificationCodeGenerator } from '#test/fakes/fake-verification-code-generator';
import { FixedClock } from '#test/fakes/fixed-clock';
import { SequentialIdGenerator } from '#test/fakes/sequential-id-generator';
import { incompatibilities } from '#test/helpers/contract';
import { emailVerifiedV1Example } from '../../contracts/events/email-verified.v1.example.js';
import { verificationCodeIssuedV1Example } from '../../contracts/events/verification-code-issued.v1.example.js';
import { User } from '../../domain/entities/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { InMemoryVerificationCodeRepository } from '../../infra/database/in-memory/in-memory-verification-code.repository.js';
import { VerificationCodeIssuer } from '../verification-code-issuer.js';
import { toIntegrationEvent } from './to-integration-event.js';

// Lado de quem publica: o que o identity realmente gera precisa ser compatível com o exemplo do contrato.
describe('contrato dos eventos publicados pelo identity', () => {
  const clock = new FixedClock();
  const newUser = () => User.register('u1', Email.create('ana@example.com'), 'Ana', 'hash');

  it('VerificationCodeIssuer gera identity.verification-code-issued v1 compatível com o exemplo', async () => {
    const outbox = new FakeOutbox();
    const issuer = new VerificationCodeIssuer(
      new InMemoryVerificationCodeRepository(),
      new FakeVerificationCodeGenerator(),
      outbox,
      new SequentialIdGenerator('id'),
      clock,
      60_000,
    );

    await issuer.issue(newUser());

    const [event] = outbox.events;
    expect(incompatibilities(verificationCodeIssuedV1Example, event)).toEqual([]);
    expect(event).toMatchObject({
      type: verificationCodeIssuedV1Example.type,
      version: verificationCodeIssuedV1Example.version,
    });
  });

  it('EmailVerified gera identity.email-verified v1 compatível com o exemplo', () => {
    const user = newUser();
    user.verifyEmail(clock.now());

    const [event] = user
      .pullDomainEvents()
      .map((e) => toIntegrationEvent(e, { eventId: 'e1', occurredAt: clock.now() }));

    expect(incompatibilities(emailVerifiedV1Example, event)).toEqual([]);
    expect(event).toMatchObject({
      type: emailVerifiedV1Example.type,
      version: emailVerifiedV1Example.version,
    });
  });
});
