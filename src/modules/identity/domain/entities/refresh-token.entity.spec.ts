import { describe, it, expect } from 'vitest';
import { RefreshToken } from './refresh-token.entity.js';

const HOUR = 60 * 60 * 1000;
const policy = { ttlMs: 10 * HOUR, familyMaxAgeMs: 24 * HOUR };
const t0 = new Date('2026-01-01T00:00:00.000Z');
const at = (hours: number) => new Date(t0.getTime() + hours * HOUR);

const start = () =>
  RefreshToken.startFamily({ id: 't1', tokenHash: 'h1', familyId: 'f1', userId: 'u1' }, t0, policy);

describe('RefreshToken', () => {
  it('abre a família com o prazo absoluto contado do login', () => {
    const token = start();
    expect(token.expiresAt).toEqual(at(10));
    expect(token.familyExpiresAt).toEqual(at(24));
    expect(token.usedAt).toBeNull();
    expect(token.revokedAt).toBeNull();
  });

  it('o sucessor herda família, usuário e prazo absoluto', () => {
    const next = start().rotate({ id: 't2', tokenHash: 'h2' }, at(5), policy);
    expect(next).toMatchObject({ id: 't2', familyId: 'f1', userId: 'u1', createdAt: at(5) });
    expect(next.expiresAt).toEqual(at(15));
    expect(next.familyExpiresAt).toEqual(at(24));
  });

  it('o sucessor nunca vence depois do prazo absoluto da família', () => {
    const next = start().rotate({ id: 't2', tokenHash: 'h2' }, at(20), policy);
    expect(next.expiresAt).toEqual(at(24));
  });

  it('deixa de servir ao vencer', () => {
    const token = start();
    expect(token.isDeadAt(at(9))).toBe(false);
    expect(token.isDeadAt(at(10))).toBe(true);
  });

  it('sabe se já foi trocado por um sucessor', () => {
    expect(start().wasUsed).toBe(false);
    expect(RefreshToken.restore({ ...start().toProps(), usedAt: at(1) }).wasUsed).toBe(true);
  });

  it('deixa de servir quando revogado', () => {
    const revoked = RefreshToken.restore({ ...start().toProps(), revokedAt: at(1) });
    expect(revoked.isDeadAt(at(2))).toBe(true);
  });
});
