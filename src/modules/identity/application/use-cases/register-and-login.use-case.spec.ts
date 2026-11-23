import { describe, it, expect, vi } from 'vitest';
import { FakePasswordHasher } from '#test/fakes/fake-password-hasher';
import { FakeTokenIssuer } from '#test/fakes/fake-token-issuer';
import { FakeTransactionManager } from '#test/fakes/fake-transaction-manager';
import { SequentialIdGenerator } from '#test/fakes/sequential-id-generator';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error.js';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error.js';
import { InvalidNameError } from '../../domain/errors/invalid-name.error.js';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error.js';
import { InMemoryUserRepository } from '../../infra/database/in-memory/in-memory-user.repository.js';
import { LoginUseCase } from './login.use-case.js';
import { RegisterUserUseCase } from './register-user.use-case.js';

function setup() {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenIssuer();
  const tx = new FakeTransactionManager();
  return {
    tokens,
    tx,
    register: new RegisterUserUseCase(users, hasher, new SequentialIdGenerator('user'), tx),
    login: new LoginUseCase(users, hasher, tokens),
  };
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

  it('grava dentro de uma transação', async () => {
    const { register, tx } = setup();
    await register.execute({ name: 'Ana', email: 'a@x.com', password: 'secret-123' });
    expect(tx.runs).toBe(1);
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
  it('devolve um token só com o sub', async () => {
    const { register, login, tokens } = setup();
    const { id } = await register.execute({
      name: 'Ana',
      email: 'a@x.com',
      password: 'secret-123',
    });

    const result = await login.execute({ email: 'A@x.com', password: 'secret-123' });

    expect(result).toEqual({ accessToken: `token-for-${id}`, expiresIn: tokens.expiresIn });
    expect(tokens.issued).toEqual([{ sub: id }]);
  });

  it('rejeita senha errada', async () => {
    const { register, login } = setup();
    await register.execute({ name: 'Ana', email: 'a@x.com', password: 'secret-123' });
    await expect(login.execute({ email: 'a@x.com', password: 'wrong' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('verifica a senha mesmo quando o e-mail não existe (tempo igual)', async () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    const verify = vi.spyOn(hasher, 'verify');
    const login = new LoginUseCase(users, hasher, new FakeTokenIssuer());

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
