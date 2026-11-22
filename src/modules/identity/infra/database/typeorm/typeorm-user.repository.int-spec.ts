import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { startIdentityDatabase } from '#test/helpers/identity-database';
import { User } from '../../../domain/entities/user.entity.js';
import { EmailAlreadyInUseError } from '../../../domain/errors/email-already-in-use.error.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { TypeOrmUserRepository } from './typeorm-user.repository.js';

describe('TypeOrmUserRepository (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmUserRepository;

  beforeAll(async () => {
    ({ ds, stop } = await startIdentityDatabase());
    repo = new TypeOrmUserRepository(ds);
  }, 120_000);

  afterAll(() => stop?.());

  const newUser = (email: string) =>
    User.register(crypto.randomUUID(), Email.create(email), 'Ana', 'hash');

  it('salva e busca por e-mail', async () => {
    const user = newUser('ana@x.com');
    await repo.save(user);

    const found = await repo.findByEmail(Email.create('ANA@x.com'));
    expect(found?.id).toBe(user.id);
    expect(found?.name).toBe('Ana');
    expect(found?.passwordHash).toBe('hash');
    expect(found?.roles).toEqual([]);
  });

  it('devolve null para e-mail desconhecido', async () => {
    expect(await repo.findByEmail(Email.create('ghost@x.com'))).toBeNull();
  });

  it('a constraint UNIQUE rejeita o mesmo e-mail com EmailAlreadyInUseError', async () => {
    await repo.save(newUser('dup@x.com'));
    await expect(repo.save(newUser('dup@x.com'))).rejects.toThrow(EmailAlreadyInUseError);
  });

  it('cadastros simultâneos do mesmo e-mail: só um vence', async () => {
    const results = await Promise.allSettled([
      repo.save(newUser('race@x.com')),
      repo.save(newUser('race@x.com')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(EmailAlreadyInUseError);
  });
});
