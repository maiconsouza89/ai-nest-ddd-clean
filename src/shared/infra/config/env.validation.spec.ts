import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('aceita configuração válida e converte PORT para número', () => {
    const env = validateEnv({ DATABASE_URL: 'postgres://x', PORT: '4000', NODE_ENV: 'test' });
    expect(env.PORT).toBe(4000);
  });

  it('aplica padrões para NODE_ENV e PORT', () => {
    const env = validateEnv({ DATABASE_URL: 'postgres://x' });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
  });

  it('falha sem DATABASE_URL com mensagem clara', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('falha com PORT inválida', () => {
    expect(() => validateEnv({ DATABASE_URL: 'x', PORT: 'abc' })).toThrow(/PORT/);
  });
});
