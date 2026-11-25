import { describe, it, expect } from 'vitest';
import { loginAccountTracker } from './login-account.tracker.js';

describe('loginAccountTracker', () => {
  it('normaliza o e-mail: espaços nas pontas e maiúsculas caem na mesma chave', () => {
    expect(loginAccountTracker({ body: { email: ' User@Example.COM ' } })).toBe('user@example.com');
    expect(loginAccountTracker({ body: { email: 'user@example.com' } })).toBe('user@example.com');
  });

  it.each([
    ['número', { email: 42 }],
    ['objeto', { email: { $ne: '' } }],
    ['array', { email: ['user@example.com'] }],
    ['e-mail inválido', { email: 'not-an-email' }],
    ['sem e-mail', {}],
    ['corpo ausente', undefined],
  ])('devolve undefined com %s', (_case, body) => {
    expect(loginAccountTracker({ body })).toBeUndefined();
  });
});
