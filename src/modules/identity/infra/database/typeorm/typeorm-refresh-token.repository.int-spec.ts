import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FakeTokenIssuer } from '#test/fakes/fake-token-issuer';
import { FixedClock } from '#test/fakes/fixed-clock';
import { uniqueEmail } from '#test/helpers/auth';
import { startIdentityDatabase } from '#test/helpers/identity-database';
import { UuidV7Generator } from '#shared/infra/runtime/uuid-v7.generator';
import { TypeOrmTransactionManager } from '#shared/infra/database/typeorm-transaction-manager';
import { SessionIssuer } from '../../../application/session-issuer.js';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case.js';
import { PurgeExpiredRefreshTokensUseCase } from '../../../application/use-cases/purge-expired-refresh-tokens.use-case.js';
import { RefreshSessionUseCase } from '../../../application/use-cases/refresh-session.use-case.js';
import { User } from '../../../domain/entities/user.entity.js';
import { InvalidRefreshTokenError } from '../../../domain/errors/invalid-refresh-token.error.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { CryptoOpaqueTokenGenerator } from '../../adapters/crypto-opaque-token-generator.js';
import { TypeOrmRefreshTokenRepository } from './typeorm-refresh-token.repository.js';
import { TypeOrmUserRepository } from './typeorm-user.repository.js';

const DAY = 24 * 60 * 60 * 1000;

describe('Refresh token rotativo (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmRefreshTokenRepository;
  let sessions: SessionIssuer;
  let refresh: RefreshSessionUseCase;
  let logout: LogoutUseCase;
  let tx: TypeOrmTransactionManager;
  const secrets = new CryptoOpaqueTokenGenerator();
  const clock = new FixedClock(new Date());

  beforeAll(async () => {
    ({ ds, stop } = await startIdentityDatabase());
    repo = new TypeOrmRefreshTokenRepository(ds);
    tx = new TypeOrmTransactionManager(ds);
    sessions = new SessionIssuer(
      new FakeTokenIssuer(),
      repo,
      secrets,
      new UuidV7Generator(),
      clock,
      { ttlMs: 30 * DAY, familyMaxAgeMs: 90 * DAY },
    );
    refresh = new RefreshSessionUseCase(repo, secrets, sessions, clock, tx);
    logout = new LogoutUseCase(repo, secrets, clock, tx);
  });

  afterAll(() => stop?.());

  const newUser = async () => {
    const user = User.register(crypto.randomUUID(), Email.create(uniqueEmail()), 'Ana', 'hash');
    await new TypeOrmUserRepository(ds).save(user);
    return user.id;
  };

  const familyOf = async (refreshToken: string) =>
    (await repo.findByHash(secrets.hash(refreshToken)))!.familyId;

  it('grava só o hash do token', async () => {
    const { refreshToken } = await sessions.start(await newUser());
    const rows = await ds.query<{ tokenHash: string }[]>(
      `SELECT "tokenHash" FROM identity.refresh_tokens WHERE "tokenHash" = $1`,
      [secrets.hash(refreshToken)],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(refreshToken);
  });

  it('reuso: a segunda troca do mesmo token é recusada e revoga o sucessor da primeira', async () => {
    const { refreshToken } = await sessions.start(await newUser());
    const first = await refresh.execute(refreshToken);

    await expect(refresh.execute(refreshToken)).rejects.toThrow(InvalidRefreshTokenError);

    // a revogação foi confirmada no banco mesmo com o erro
    await expect(refresh.execute(first.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    const revoked = await ds.query<{ revokedAt: Date | null }[]>(
      `SELECT "revokedAt" FROM identity.refresh_tokens WHERE "familyId" = $1`,
      [await familyOf(refreshToken)],
    );
    expect(revoked).toHaveLength(2);
    expect(revoked.every((r) => r.revokedAt !== null)).toBe(true);
  });

  it('duas renovações simultâneas com o mesmo token: só uma vence', async () => {
    const { refreshToken } = await sessions.start(await newUser());

    const results = await Promise.allSettled([
      refresh.execute(refreshToken),
      refresh.execute(refreshToken),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('logout revoga a família', async () => {
    const { refreshToken } = await sessions.start(await newUser());
    await logout.execute(refreshToken);
    await expect(refresh.execute(refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('não marca como usado um token cuja família foi revogada depois da leitura', async () => {
    const { refreshToken } = await sessions.start(await newUser());
    const token = (await repo.findByHash(secrets.hash(refreshToken)))!;

    await logout.execute(refreshToken); // logout entre o findByHash e o markUsed da renovação

    expect(await repo.markUsed(token.id, clock.now())).toBe(false);
  });

  it('a revogação pega o sucessor de uma renovação ainda em andamento', async () => {
    const { refreshToken } = await sessions.start(await newUser());
    const token = (await repo.findByHash(secrets.hash(refreshToken)))!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let successor = '';

    // a renovação grava o sucessor e segura a transação aberta, sem confirmar
    const rotation = tx.run(async () => {
      await repo.markUsed(token.id, clock.now());
      ({ refreshToken: successor } = await sessions.rotate(token));
      await gate;
    });
    await new Promise((r) => setTimeout(r, 200));
    const revocation = logout.execute(refreshToken); // começa enquanto a renovação está aberta
    await new Promise((r) => setTimeout(r, 200));
    release();
    await Promise.all([rotation, revocation]);

    const next = await repo.findByHash(secrets.hash(successor));
    expect(next?.revokedAt).not.toBeNull();
  });

  it('apagar o usuário apaga as sessões dele', async () => {
    const userId = await newUser();
    const { refreshToken } = await sessions.start(userId);

    await ds.query(`DELETE FROM identity.users WHERE id = $1`, [userId]);

    expect(await repo.findByHash(secrets.hash(refreshToken))).toBeNull();
  });

  it('a limpeza apaga só os tokens vencidos', async () => {
    const { refreshToken: alive } = await sessions.start(await newUser());
    const { refreshToken: old } = await sessions.start(await newUser());
    await ds.query(`UPDATE identity.refresh_tokens SET "expiresAt" = $2 WHERE "tokenHash" = $1`, [
      secrets.hash(old),
      new Date(clock.now().getTime() - 1000),
    ]);

    const purged = await new PurgeExpiredRefreshTokensUseCase(repo, clock).execute();

    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await repo.findByHash(secrets.hash(old))).toBeNull();
    expect(await repo.findByHash(secrets.hash(alive))).not.toBeNull();
  });
});
