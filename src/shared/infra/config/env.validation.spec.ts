import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation.js';

// só as obrigatórias, com valores válidos; cada caso tira ou troca uma
const REQUIRED = {
  DATABASE_URL: 'postgres://x',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  SMTP_URL: 'smtp://127.0.0.1:1025',
  EMAIL_FROM: 'no-reply@example.com',
};

const without = (key: keyof typeof REQUIRED) =>
  Object.fromEntries(Object.entries(REQUIRED).filter(([k]) => k !== key));

describe('validateEnv', () => {
  it('aceita configuração válida e converte PORT para número', () => {
    const env = validateEnv({ ...REQUIRED, PORT: '4000', NODE_ENV: 'test' });
    expect(env.PORT).toBe(4000);
  });

  it('aplica padrões para NODE_ENV e PORT', () => {
    const env = validateEnv(REQUIRED);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
  });

  it.each(Object.keys(REQUIRED) as (keyof typeof REQUIRED)[])(
    'falha sem %s, com a variável na mensagem',
    (key) => {
      expect(() => validateEnv(without(key))).toThrow(new RegExp(key));
    },
  );

  it('falha com segredo curto', () => {
    expect(() => validateEnv({ ...REQUIRED, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it.each(['http://mail.example.com', '127.0.0.1:1025'])('recusa SMTP_URL "%s"', (url) => {
    expect(() => validateEnv({ ...REQUIRED, SMTP_URL: url })).toThrow(/SMTP_URL/);
  });

  it('aceita SMTP_URL com TLS e credenciais', () => {
    const url = 'smtps://user:pass@smtp.example.com:465';
    expect(validateEnv({ ...REQUIRED, SMTP_URL: url }).SMTP_URL).toBe(url);
  });

  it('usa 15 minutos como validade padrão do access token', () => {
    expect(validateEnv(REQUIRED).JWT_ACCESS_TTL_SECONDS).toBe(900);
  });

  it('usa 10 minutos como validade padrão do código de verificação e recusa menos de 1 minuto', () => {
    expect(validateEnv(REQUIRED).EMAIL_VERIFICATION_CODE_TTL_SECONDS).toBe(600);
    expect(() => validateEnv({ ...REQUIRED, EMAIL_VERIFICATION_CODE_TTL_SECONDS: '59' })).toThrow(
      /EMAIL_VERIFICATION_CODE_TTL_SECONDS/,
    );
  });

  it('recusa JWT_EXPIRES_IN_SECONDS e aponta o nome novo', () => {
    expect(() => validateEnv({ ...REQUIRED, JWT_EXPIRES_IN_SECONDS: '3600' })).toThrow(
      'JWT_EXPIRES_IN_SECONDS: renamed to JWT_ACCESS_TTL_SECONDS',
    );
  });

  it('usa 0 como atraso padrão do desligamento e recusa valor negativo ou acima de 10 minutos', () => {
    expect(validateEnv(REQUIRED).SHUTDOWN_GRACE_MS).toBe(0);
    expect(validateEnv({ ...REQUIRED, SHUTDOWN_GRACE_MS: '10000' }).SHUTDOWN_GRACE_MS).toBe(10000);
    expect(() => validateEnv({ ...REQUIRED, SHUTDOWN_GRACE_MS: '-1' })).toThrow(
      /SHUTDOWN_GRACE_MS/,
    );
    expect(() => validateEnv({ ...REQUIRED, SHUTDOWN_GRACE_MS: '600001' })).toThrow(
      /SHUTDOWN_GRACE_MS/,
    );
  });

  it('usa os padrões do projeto para o pool e os timeouts do Postgres', () => {
    const env = validateEnv(REQUIRED);
    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.DATABASE_CONNECT_TIMEOUT_MS).toBe(5000);
    expect(env.DATABASE_STATEMENT_TIMEOUT_MS).toBe(30_000);
    expect(env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS).toBe(60_000);
  });

  it.each(['DATABASE_STATEMENT_TIMEOUT_MS', 'DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS'] as const)(
    'aceita 0 em %s',
    (key) => {
      expect(validateEnv({ ...REQUIRED, [key]: '0' })[key]).toBe(0);
    },
  );

  it.each([
    ['DATABASE_POOL_MAX', '-1'],
    ['DATABASE_POOL_MAX', 'abc'],
    ['DATABASE_POOL_MAX', '0'],
    ['DATABASE_CONNECT_TIMEOUT_MS', '-1'],
    ['DATABASE_CONNECT_TIMEOUT_MS', 'abc'],
    ['DATABASE_CONNECT_TIMEOUT_MS', '0'],
    ['DATABASE_STATEMENT_TIMEOUT_MS', '-1'],
    ['DATABASE_STATEMENT_TIMEOUT_MS', 'abc'],
    ['DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS', '-1'],
    ['DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS', '1.5'],
    // vazio viraria 0, que desliga o limite
    ['DATABASE_STATEMENT_TIMEOUT_MS', ''],
    ['DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS', ' '],
    // acima do que o setTimeout do Node e o Postgres aceitam
    ['DATABASE_CONNECT_TIMEOUT_MS', '2147483648'],
    ['DATABASE_STATEMENT_TIMEOUT_MS', '2147483648'],
  ])('recusa %s=%s', (key, value) => {
    expect(() => validateEnv({ ...REQUIRED, [key]: value })).toThrow(new RegExp(key));
  });

  it('falha com PORT inválida', () => {
    expect(() => validateEnv({ ...REQUIRED, PORT: 'abc' })).toThrow(/PORT/);
  });
});
