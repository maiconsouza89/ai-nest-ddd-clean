import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation.js';

const SECRET = 'a'.repeat(32);
const REDIS = 'redis://localhost:6379';

describe('validateEnv', () => {
  it('aceita configuração válida e converte PORT para número', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgres://x',
      REDIS_URL: REDIS,
      JWT_SECRET: SECRET,
      PORT: '4000',
      NODE_ENV: 'test',
    });
    expect(env.PORT).toBe(4000);
  });

  it('aplica padrões para NODE_ENV e PORT', () => {
    const env = validateEnv({ DATABASE_URL: 'postgres://x', REDIS_URL: REDIS, JWT_SECRET: SECRET });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
  });

  it('falha sem DATABASE_URL com mensagem clara', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('falha sem REDIS_URL com mensagem clara', () => {
    expect(() => validateEnv({ DATABASE_URL: 'x', JWT_SECRET: SECRET })).toThrow(/REDIS_URL/);
  });

  it('falha sem JWT_SECRET ou com segredo curto', () => {
    expect(() => validateEnv({ DATABASE_URL: 'x', REDIS_URL: REDIS })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ DATABASE_URL: 'x', REDIS_URL: REDIS, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('usa 15 minutos como validade padrão do access token', () => {
    const env = validateEnv({ DATABASE_URL: 'x', REDIS_URL: REDIS, JWT_SECRET: SECRET });
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
  });

  it('recusa JWT_EXPIRES_IN_SECONDS e aponta o nome novo', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'x',
        REDIS_URL: REDIS,
        JWT_SECRET: SECRET,
        JWT_EXPIRES_IN_SECONDS: '3600',
      }),
    ).toThrow('JWT_EXPIRES_IN_SECONDS: renamed to JWT_ACCESS_TTL_SECONDS');
  });

  it('falha com PORT inválida', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'x', REDIS_URL: REDIS, JWT_SECRET: SECRET, PORT: 'abc' }),
    ).toThrow(/PORT/);
  });
});
