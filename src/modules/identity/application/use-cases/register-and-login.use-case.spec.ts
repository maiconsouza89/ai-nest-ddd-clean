import { describe, it, expect, vi } from 'vitest';
import { FakeOpaqueTokenGenerator } from '#test/fakes/fake-opaque-token-generator';
import { FakeOutbox } from '#test/fakes/fake-outbox';
import { FakePasswordHasher } from '#test/fakes/fake-password-hasher';
import { FakeTokenIssuer } from '#test/fakes/fake-token-issuer';
import { FixedClock } from '#test/fakes/fixed-clock';
import { FakeTransactionManager } from '#test/fakes/fake-transaction-manager';
import { SequentialIdGenerator } from '#test/fakes/sequential-id-generator';
import { FakeVerificationCodeGenerator } from '#test/fakes/fake-verification-code-generator';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error.js';
import { EmailNotVerifiedError } from '../../domain/errors/email-not-verified.error.js';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error.js';
import { InvalidNameError } from '../../domain/errors/invalid-name.error.js';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error.js';
import { InMemoryRefreshTokenRepository } from '../../infra/database/in-memory/in-memory-refresh-token.repository.js';
import { InMemoryUserRepository } from '../../infra/database/in-memory/in-memory-user.repository.js';
import { InMemoryVerificationCodeRepository } from '../../infra/database/in-memory/in-memory-verification-code.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { SessionIssuer } from '../session-issuer.js';
import { VerificationCodeIssuer } from '../verification-code-issuer.js';
import { LoginUseCase } from './login.use-case.js';
import { RegisterUserUseCase } from './register-user.use-case.js';

const sessionIssuer = (tokens = new FakeTokenIssuer()) =>
  new SessionIssuer(
    tokens,
    new InMemoryRefreshTokenRepository(),
    new FakeOpaqueTokenGenerator(),
    new SequentialIdGenerator('rt'),
    new FixedClock(),
    { ttlMs: 60_000, familyMaxAgeMs: 120_000 },
  );

const TTL_MS = 10 * 60 * 1000;

function setup() {
  const users = new InMemoryUserRepository();
  const codes = new InMemoryVerificationCodeRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenIssuer();
  const tx = new FakeTransactionManager();
  const outbox = new FakeOutbox();
  const clock = new FixedClock();
  const ids = new SequentialIdGenerator('user');
  const issuer = new VerificationCodeIssuer(
    codes,
    new FakeVerificationCodeGenerator(),
    outbox,
    new SequentialIdGenerator('id'),
    clock,
    TTL_MS,
  );
  return {
    users,
    codes,
    tokens,
    tx,
    outbox,
    clock,
    register: new RegisterUserUseCase(users, hasher, ids, tx, issuer),
    login: new LoginUseCase(users, hasher, sessionIssuer(tokens)),
  };
}

const ana = { name: 'Ana', email: 'a@x.com', password: 'secret-123' };

// o register deixa o e-mail por verificar; o login dos testes de sessão precisa dele verificado
async function registerVerified(s: ReturnType<typeof setup>) {
  const { id } = await s.register.execute(ana);
  const user = (await s.users.findByEmail(Email.create(ana.email)))!;
  user.verifyEmail(s.clock.now());
  await s.users.save(user);
  return id;
}

describe('RegisterUserUseCase', () => {
  it('cadastra o usuário e devolve o id', async () => {
    const { register } = setup();
    expect(
      await register.execute({ name: 'Ana', email: 'a@x.com', password: 'secret-123' }),
    ).toEqual({
      id: 'user-1',
    });
  });

  it('grava o usuário por verificar, o código e o evento numa transação só', async () => {
    const { register, tx, users, codes, outbox, clock } = setup();
    await register.execute(ana);

    expect(tx.runs).toBe(1);
    expect((await users.findByEmail(Email.create(ana.email)))?.isEmailVerified).toBe(false);
    expect(codes.all()).toEqual([
      expect.objectContaining({ userId: 'user-1', codeHash: 'hash:000001', attempts: 0 }),
    ]);
    expect(outbox.aggregateIds).toEqual(['user-1']);
    expect(outbox.events).toEqual([
      expect.objectContaining({
        type: 'identity.verification-code-issued',
        version: 1,
        payload: {
          userId: 'user-1',
          email: 'a@x.com',
          name: 'Ana',
          code: '000001',
          expiresAt: new Date(clock.now().getTime() + TTL_MS).toISOString(),
        },
      }),
    ]);
  });

  it('rejeita e-mail repetido, ignorando caixa e espaços', async () => {
    const { register } = setup();
    await register.execute({ name: 'Ana', email: 'a@x.com', password: 'secret-123' });
    await expect(
      register.execute({ name: 'Ana', email: ' A@X.com ', password: 'other-123' }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejeita nome inválido "%s"', async (name) => {
    const { register } = setup();
    await expect(
      register.execute({ name, email: 'a@x.com', password: 'secret-123' }),
    ).rejects.toThrow(InvalidNameError);
  });

  it('rejeita e-mail inválido', async () => {
    const { register } = setup();
    await expect(
      register.execute({ name: 'Ana', email: 'nope', password: 'secret-123' }),
    ).rejects.toThrow(InvalidEmailError);
  });
});

describe('LoginUseCase', () => {
  it('abre a sessão: access token só com o sub e refresh token', async () => {
    const s = setup();
    const { login, tokens } = s;
    const id = await registerVerified(s);

    const result = await login.execute({ email: 'A@x.com', password: 'secret-123' });

    expect(result).toEqual({
      accessToken: `token-for-${id}`,
      expiresIn: tokens.expiresIn,
      refreshToken: 'rt-1',
    });
    expect(tokens.issued).toEqual([{ sub: id }]);
  });

  it('rejeita senha errada', async () => {
    const s = setup();
    await registerVerified(s);
    await expect(s.login.execute({ email: 'a@x.com', password: 'wrong' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('conta não verificada: com a senha certa, EMAIL_NOT_VERIFIED, e sem sessão', async () => {
    const { register, login, tokens } = setup();
    await register.execute(ana);
    await expect(login.execute({ email: ana.email, password: ana.password })).rejects.toThrow(
      EmailNotVerifiedError,
    );
    expect(tokens.issued).toEqual([]);
  });

  it('conta não verificada: com a senha errada, INVALID_CREDENTIALS', async () => {
    const { register, login } = setup();
    await register.execute(ana);
    await expect(login.execute({ email: ana.email, password: 'wrong' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('verifica a senha mesmo quando o e-mail não existe (tempo igual)', async () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    const verify = vi.spyOn(hasher, 'verify');
    const login = new LoginUseCase(users, hasher, sessionIssuer());

    await expect(login.execute({ email: 'ghost@x.com', password: 'secret-123' })).rejects.toThrow(
      InvalidCredentialsError,
    );
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it.each(['ghost@x.com', 'not-an-email'])('rejeita "%s" com a mesma resposta', async (email) => {
    const { login } = setup();
    await expect(login.execute({ email, password: 'secret-123' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});
