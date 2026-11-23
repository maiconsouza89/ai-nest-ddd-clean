import { describe, it, expect } from 'vitest';
import { FakeOpaqueTokenGenerator } from '#test/fakes/fake-opaque-token-generator';
import { FakeTokenIssuer } from '#test/fakes/fake-token-issuer';
import { FakeTransactionManager } from '#test/fakes/fake-transaction-manager';
import { FixedClock } from '#test/fakes/fixed-clock';
import { SequentialIdGenerator } from '#test/fakes/sequential-id-generator';
import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error.js';
import { InMemoryRefreshTokenRepository } from '../../infra/database/in-memory/in-memory-refresh-token.repository.js';
import { SessionIssuer } from '../session-issuer.js';
import { LogoutUseCase } from './logout.use-case.js';
import { PurgeExpiredRefreshTokensUseCase } from './purge-expired-refresh-tokens.use-case.js';
import { RefreshSessionUseCase } from './refresh-session.use-case.js';

const HOUR = 60 * 60 * 1000;

function setup() {
  const repo = new InMemoryRefreshTokenRepository();
  const secrets = new FakeOpaqueTokenGenerator();
  const clock = new FixedClock();
  const accessTokens = new FakeTokenIssuer();
  const sessions = new SessionIssuer(
    accessTokens,
    repo,
    secrets,
    new SequentialIdGenerator('id'),
    clock,
    { ttlMs: 10 * HOUR, familyMaxAgeMs: 24 * HOUR },
  );
  const tx = new FakeTransactionManager();
  return {
    repo,
    clock,
    accessTokens,
    sessions,
    tx,
    refresh: new RefreshSessionUseCase(repo, secrets, sessions, clock, tx),
    logout: new LogoutUseCase(repo, secrets, clock, tx),
  };
}

describe('SessionIssuer.start (login)', () => {
  it('devolve o access token e um refresh token, gravado só como hash', async () => {
    const { sessions, repo } = setup();

    const session = await sessions.start('u1');

    expect(session).toEqual({ accessToken: 'token-for-u1', expiresIn: 60, refreshToken: 'rt-1' });
    expect(repo.all()).toEqual([
      expect.objectContaining({ userId: 'u1', tokenHash: 'hash:rt-1', usedAt: null }),
    ]);
  });

  it('cada login abre uma família própria', async () => {
    const { sessions, repo } = setup();
    await sessions.start('u1');
    await sessions.start('u1');
    const [a, b] = repo.all();
    expect(a.familyId).not.toBe(b.familyId);
  });
});

describe('RefreshSessionUseCase', () => {
  it('troca o token por um par novo na mesma família e marca o antigo como usado', async () => {
    const { sessions, refresh, repo, clock, accessTokens } = setup();
    await sessions.start('u1');
    clock.advance(HOUR);

    const session = await refresh.execute('rt-1');

    expect(session.refreshToken).toBe('rt-2');
    expect(accessTokens.issued).toEqual([{ sub: 'u1' }, { sub: 'u1' }]);
    const [first, second] = repo.all();
    expect(first.usedAt).toEqual(clock.now());
    expect(second.familyId).toBe(first.familyId);
  });

  it('marca o uso e grava o sucessor na mesma transação', async () => {
    const { sessions, refresh, tx } = setup();
    await sessions.start('u1');
    await refresh.execute('rt-1');
    expect(tx.runs).toBe(1);
  });

  it('reuso: recusa e revoga a família, inclusive o sucessor já emitido', async () => {
    const { sessions, refresh, repo } = setup();
    await sessions.start('u1');
    await refresh.execute('rt-1');

    await expect(refresh.execute('rt-1')).rejects.toThrow(InvalidRefreshTokenError);

    expect(repo.all().every((t) => t.revokedAt !== null)).toBe(true);
    await expect(refresh.execute('rt-2')).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('recusa token vencido sem revogar a família', async () => {
    const { sessions, refresh, repo, clock } = setup();
    await sessions.start('u1');
    clock.advance(10 * HOUR);

    await expect(refresh.execute('rt-1')).rejects.toThrow(InvalidRefreshTokenError);
    expect(repo.all()[0].revokedAt).toBeNull();
  });

  it('recusa token desconhecido', async () => {
    const { refresh } = setup();
    await expect(refresh.execute('nope')).rejects.toThrow(InvalidRefreshTokenError);
  });
});

describe('LogoutUseCase', () => {
  it('revoga a família, e o refresh seguinte é recusado', async () => {
    const { sessions, refresh, logout } = setup();
    await sessions.start('u1');
    await refresh.execute('rt-1');

    await logout.execute('rt-2');

    await expect(refresh.execute('rt-2')).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('não falha com token desconhecido', async () => {
    const { logout } = setup();
    await expect(logout.execute('nope')).resolves.toBeUndefined();
  });

  it('não encerra as outras sessões do usuário', async () => {
    const { sessions, refresh, logout } = setup();
    await sessions.start('u1');
    await sessions.start('u1');

    await logout.execute('rt-1');

    await expect(refresh.execute('rt-2')).resolves.toMatchObject({ refreshToken: 'rt-3' });
  });
});

describe('PurgeExpiredRefreshTokensUseCase', () => {
  it('apaga os tokens vencidos, em lotes até não sobrar nenhum', async () => {
    const { sessions, repo, clock } = setup();
    await sessions.start('u1');
    await sessions.start('u2');
    await sessions.start('u3');
    clock.advance(9 * HOUR);
    await sessions.start('u4');
    clock.advance(2 * HOUR);
    const purge = new PurgeExpiredRefreshTokensUseCase(repo, clock, 2);

    expect(await purge.execute()).toBe(3);
    expect(repo.all().map((t) => t.userId)).toEqual(['u4']);
  });
});
