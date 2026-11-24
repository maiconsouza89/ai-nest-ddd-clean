import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { uniqueEmail } from '#test/helpers/auth';
import { startIdentityDatabase } from '#test/helpers/identity-database';
import { FakeOutbox } from '#test/fakes/fake-outbox';
import { FixedClock } from '#test/fakes/fixed-clock';
import { TypeOrmTransactionManager } from '#shared/infra/database/typeorm-transaction-manager';
import { UuidV7Generator } from '#shared/infra/ids/uuid-v7.generator';
import { VerifyEmailUseCase } from '../../../application/use-cases/verify-email.use-case.js';
import { CryptoVerificationCodeGenerator } from '../../adapters/crypto-verification-code-generator.js';
import { User } from '../../../domain/entities/user.entity.js';
import { VerificationCode } from '../../../domain/entities/verification-code.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { TypeOrmUserRepository } from './typeorm-user.repository.js';
import { TypeOrmVerificationCodeRepository } from './typeorm-verification-code.repository.js';

const MINUTE = 60 * 1000;

describe('Código de verificação (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmVerificationCodeRepository;
  let tx: TypeOrmTransactionManager;
  const now = new Date();

  beforeAll(async () => {
    ({ ds, stop } = await startIdentityDatabase());
    repo = new TypeOrmVerificationCodeRepository(ds);
    tx = new TypeOrmTransactionManager(ds);
  }, 120_000);

  afterAll(() => stop?.());

  const newUser = async () => {
    const user = User.register(crypto.randomUUID(), Email.create(uniqueEmail()), 'Ana', 'hash');
    await new TypeOrmUserRepository(ds).save(user);
    return user.id;
  };

  const issue = (userId: string, codeHash: string, at = now) =>
    VerificationCode.issue({ id: crypto.randomUUID(), userId, codeHash }, at, 10 * MINUTE);

  const latest = (userId: string) => tx.run(() => repo.findLatestForUpdate(userId));

  it('grava e lê o código ativo do usuário', async () => {
    const userId = await newUser();
    const code = issue(userId, 'a'.repeat(64));
    await tx.run(() => repo.add(code));

    expect((await latest(userId))?.toProps()).toEqual(code.toProps());
  });

  it('emitir um segundo código invalida o primeiro', async () => {
    const userId = await newUser();
    const first = issue(userId, 'a'.repeat(64));
    const second = issue(userId, 'b'.repeat(64), new Date(now.getTime() + MINUTE));
    await tx.run(() => repo.add(first));
    await tx.run(() => repo.add(second));

    expect((await latest(userId))?.id).toBe(second.id);
    const [old] = await ds.query<{ usedAt: Date | null }[]>(
      `SELECT "usedAt" FROM identity.email_verification_codes WHERE id = $1`,
      [first.id],
    );
    expect(old.usedAt).toEqual(second.createdAt);
  });

  it('conta os códigos emitidos desde uma data, inclusive os invalidados', async () => {
    const userId = await newUser();
    const minute = (n: number) => new Date(now.getTime() + n * MINUTE);
    await tx.run(() => repo.add(issue(userId, 'a'.repeat(64), minute(0))));
    await tx.run(() => repo.add(issue(userId, 'b'.repeat(64), minute(2))));
    await tx.run(() => repo.add(issue(userId, 'c'.repeat(64), minute(4))));

    expect(await repo.countIssuedSince(userId, minute(0))).toBe(3);
    expect(await repo.countIssuedSince(userId, minute(1))).toBe(2);
    expect(await repo.countIssuedSince(await newUser(), minute(0))).toBe(0);
  });

  it('grava as tentativas e o uso', async () => {
    const userId = await newUser();
    const code = issue(userId, 'a'.repeat(64));
    await tx.run(() => repo.add(code));

    code.verify('wrong', now);
    code.verify('a'.repeat(64), now);
    await repo.save(code);

    expect(await latest(userId)).toMatchObject({ attempts: 1, usedAt: now });
  });

  it('apagar o usuário apaga os códigos dele', async () => {
    const userId = await newUser();
    await tx.run(() => repo.add(issue(userId, 'a'.repeat(64))));

    await ds.query(`DELETE FROM identity.users WHERE id = $1`, [userId]);

    expect(await latest(userId)).toBeNull();
  });

  it('tentativas erradas simultâneas contam uma a uma e param no limite', async () => {
    const users = new TypeOrmUserRepository(ds);
    const user = User.register(crypto.randomUUID(), Email.create(uniqueEmail()), 'Ana', 'hash');
    await users.save(user);
    // o hash real, com os 64 caracteres da coluna `char(64)`: um valor curto voltaria com espaços
    const generator = new CryptoVerificationCodeGenerator();
    await tx.run(() => repo.add(issue(user.id, generator.hash('000001'))));
    const verify = new VerifyEmailUseCase(
      users,
      repo,
      generator,
      new FakeOutbox(),
      new UuidV7Generator(),
      new FixedClock(now),
      tx,
    );

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => verify.execute({ email: user.email.value, code: '999999' })),
    );

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect((await latest(user.id))?.attempts).toBe(5);
    // esgotado: nem o código certo vale mais
    await expect(verify.execute({ email: user.email.value, code: '000001' })).rejects.toThrow();
  });

  it('o usuário volta do banco com a data da verificação', async () => {
    const users = new TypeOrmUserRepository(ds);
    const user = User.register(crypto.randomUUID(), Email.create(uniqueEmail()), 'Ana', 'hash');
    await users.save(user);
    expect((await users.findByEmail(user.email))?.emailVerifiedAt).toBeNull();

    user.verifyEmail(now);
    await users.save(user);

    expect((await users.findByEmail(user.email))?.emailVerifiedAt).toEqual(now);
  });
});
