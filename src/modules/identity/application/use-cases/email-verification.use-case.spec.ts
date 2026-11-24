import { describe, it, expect } from 'vitest';
import { FakeOutbox } from '#test/fakes/fake-outbox';
import { FakeTransactionManager } from '#test/fakes/fake-transaction-manager';
import { FakeVerificationCodeGenerator } from '#test/fakes/fake-verification-code-generator';
import { FixedClock } from '#test/fakes/fixed-clock';
import { SequentialIdGenerator } from '#test/fakes/sequential-id-generator';
import { User } from '../../domain/entities/user.entity.js';
import { InvalidVerificationCodeError } from '../../domain/errors/invalid-verification-code.error.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { InMemoryUserRepository } from '../../infra/database/in-memory/in-memory-user.repository.js';
import { InMemoryVerificationCodeRepository } from '../../infra/database/in-memory/in-memory-verification-code.repository.js';
import { VerificationCodeIssuer } from '../verification-code-issuer.js';
import { RESEND_INTERVAL_MS } from '../../domain/entities/verification-code.entity.js';
import { ResendVerificationCodeUseCase } from './resend-verification-code.use-case.js';
import { VerifyEmailUseCase } from './verify-email.use-case.js';

const TTL_MS = 10 * 60 * 1000;
const EMAIL = 'ana@x.com';

async function setup() {
  const users = new InMemoryUserRepository();
  const codes = new InMemoryVerificationCodeRepository();
  const generator = new FakeVerificationCodeGenerator();
  const outbox = new FakeOutbox();
  const ids = new SequentialIdGenerator('id');
  const clock = new FixedClock();
  const tx = new FakeTransactionManager();
  const issuer = new VerificationCodeIssuer(codes, generator, outbox, ids, clock, TTL_MS);

  const user = User.register('u1', Email.create(EMAIL), 'Ana', 'hash');
  await users.save(user);
  // o código 000001, como no register; o teste olha só a outbox que vem depois
  await issuer.issue(user);
  outbox.events.length = 0;
  outbox.aggregateIds.length = 0;

  return {
    users,
    codes,
    outbox,
    clock,
    resend: new ResendVerificationCodeUseCase(users, codes, issuer, clock, tx),
    verify: new VerifyEmailUseCase(users, codes, generator, outbox, ids, clock, tx),
    stored: async () => (await users.findByEmail(Email.create(EMAIL)))!,
  };
}

describe('VerifyEmailUseCase', () => {
  it('com o código certo, verifica o e-mail e grava identity.email-verified', async () => {
    const { verify, outbox, stored, clock } = await setup();

    await verify.execute({ email: EMAIL, code: '000001' });

    expect((await stored()).emailVerifiedAt).toEqual(clock.now());
    expect(outbox.aggregateIds).toEqual(['u1']);
    expect(outbox.events).toEqual([
      expect.objectContaining({
        type: 'identity.email-verified',
        version: 1,
        payload: { userId: 'u1', email: EMAIL, name: 'Ana' },
      }),
    ]);
  });

  it('com o código errado, conta a tentativa, lança o erro e não grava evento', async () => {
    const { verify, codes, outbox, stored } = await setup();

    await expect(verify.execute({ email: EMAIL, code: '999999' })).rejects.toThrow(
      InvalidVerificationCodeError,
    );

    expect(codes.all()[0].attempts).toBe(1);
    expect((await stored()).isEmailVerified).toBe(false);
    expect(outbox.events).toEqual([]);
  });

  it('o código não vale duas vezes', async () => {
    const { verify } = await setup();
    await verify.execute({ email: EMAIL, code: '000001' });
    await expect(verify.execute({ email: EMAIL, code: '000001' })).rejects.toThrow(
      InvalidVerificationCodeError,
    );
  });

  it('recusa o código vencido', async () => {
    const { verify, clock } = await setup();
    clock.advance(TTL_MS);
    await expect(verify.execute({ email: EMAIL, code: '000001' })).rejects.toThrow(
      InvalidVerificationCodeError,
    );
  });

  it.each(['ghost@x.com', 'not-an-email'])('e-mail "%s" dá o mesmo erro', async (email) => {
    const { verify } = await setup();
    await expect(verify.execute({ email, code: '000001' })).rejects.toThrow(
      InvalidVerificationCodeError,
    );
  });
});

describe('ResendVerificationCodeUseCase', () => {
  it('passado o intervalo, emite um código novo, que invalida o anterior', async () => {
    const { resend, verify, outbox, clock } = await setup();
    clock.advance(RESEND_INTERVAL_MS);

    await resend.execute({ email: EMAIL });

    expect(outbox.events).toEqual([
      expect.objectContaining({
        type: 'identity.verification-code-issued',
        payload: expect.objectContaining({ email: EMAIL, code: '000002' }),
      }),
    ]);
    await expect(verify.execute({ email: EMAIL, code: '000001' })).rejects.toThrow(
      InvalidVerificationCodeError,
    );
    await expect(verify.execute({ email: EMAIL, code: '000002' })).resolves.toBeUndefined();
  });

  it('antes do intervalo, termina sem erro e sem evento', async () => {
    const { resend, outbox, clock } = await setup();
    clock.advance(RESEND_INTERVAL_MS - 1);
    await expect(resend.execute({ email: EMAIL })).resolves.toBeUndefined();
    expect(outbox.events).toEqual([]);
  });

  it.each(['ghost@x.com', 'not-an-email'])(
    'e-mail "%s": termina sem erro e sem evento',
    async (email) => {
      const { resend, outbox, clock } = await setup();
      clock.advance(RESEND_INTERVAL_MS);
      await expect(resend.execute({ email })).resolves.toBeUndefined();
      expect(outbox.events).toEqual([]);
    },
  );

  it('conta já verificada: termina sem erro e sem evento', async () => {
    const { resend, verify, outbox, clock } = await setup();
    await verify.execute({ email: EMAIL, code: '000001' });
    outbox.events.length = 0;
    clock.advance(RESEND_INTERVAL_MS);

    await expect(resend.execute({ email: EMAIL })).resolves.toBeUndefined();

    expect(outbox.events).toEqual([]);
  });
});
