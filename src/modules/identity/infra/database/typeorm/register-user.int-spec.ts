import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakePasswordHasher } from '#test/fakes/fake-password-hasher';
import { FixedClock } from '#test/fakes/fixed-clock';
import { uniqueEmail } from '#test/helpers/auth';
import { startIdentityDatabase } from '#test/helpers/identity-database';
import { IntegrationEvent } from '#shared/application/integration-event';
import { Outbox } from '#shared/application/ports/outbox';
import { TypeOrmTransactionManager } from '#shared/infra/database/typeorm-transaction-manager';
import { UuidV7Generator } from '#shared/infra/ids/uuid-v7.generator';
import { TypeOrmOutbox } from '#shared/infra/outbox/typeorm-outbox';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case.js';
import { VerificationCodeIssuer } from '../../../application/verification-code-issuer.js';
import { CryptoVerificationCodeGenerator } from '../../adapters/crypto-verification-code-generator.js';
import { TypeOrmUserRepository } from './typeorm-user.repository.js';
import { TypeOrmVerificationCodeRepository } from './typeorm-verification-code.repository.js';

// grava de verdade e falha logo depois: a transação inteira tem de voltar
class FailingOutbox implements Outbox {
  constructor(private readonly inner: Outbox) {}
  async add(aggregateId: string, events: IntegrationEvent[]) {
    await this.inner.add(aggregateId, events);
    throw new Error('outbox down');
  }
}

describe('RegisterUserUseCase com Postgres (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ ds, stop } = await startIdentityDatabase());
  }, 120_000);

  afterAll(() => stop?.());

  const register = (outbox: Outbox) => {
    const ids = new UuidV7Generator();
    const issuer = new VerificationCodeIssuer(
      new TypeOrmVerificationCodeRepository(ds),
      new CryptoVerificationCodeGenerator(),
      outbox,
      ids,
      new FixedClock(new Date()),
      600_000,
    );
    return new RegisterUserUseCase(
      new TypeOrmUserRepository(ds),
      new FakePasswordHasher(),
      ids,
      new TypeOrmTransactionManager(ds),
      issuer,
    );
  };

  const rowsOf = async (email: string) => {
    const [users, codes, events] = await Promise.all([
      ds.query<{ id: string }[]>(`SELECT id FROM identity.users WHERE email = $1`, [email]),
      ds.query<{ codeHash: string }[]>(
        `SELECT c."codeHash" FROM identity.email_verification_codes c
           JOIN identity.users u ON u.id = c."userId" WHERE u.email = $1`,
        [email],
      ),
      ds.query<{ type: string; payload: { code: string } }[]>(
        `SELECT type, payload FROM shared.outbox WHERE payload->>'email' = $1`,
        [email],
      ),
    ]);
    return { users, codes, events };
  };

  it('grava o usuário, o hash do código e o evento juntos', async () => {
    const email = uniqueEmail();

    await register(new TypeOrmOutbox(ds)).execute({ name: 'Ana', email, password: 'secret-123' });

    const { users, codes, events } = await rowsOf(email);
    expect(users).toHaveLength(1);
    expect(codes).toHaveLength(1);
    expect(events).toEqual([
      expect.objectContaining({ type: 'identity.verification-code-issued' }),
    ]);
    // o banco guarda o hash; o código em texto puro só viaja no evento
    expect(events[0].payload.code).toMatch(/^\d{6}$/);
    expect(codes[0].codeHash).toBe(
      new CryptoVerificationCodeGenerator().hash(events[0].payload.code),
    );
  });

  it('uma falha depois de gravar o usuário não deixa usuário, código nem evento', async () => {
    const email = uniqueEmail();

    await expect(
      register(new FailingOutbox(new TypeOrmOutbox(ds))).execute({
        name: 'Ana',
        email,
        password: 'secret-123',
      }),
    ).rejects.toThrow('outbox down');

    expect(await rowsOf(email)).toEqual({ users: [], codes: [], events: [] });
  });
});
