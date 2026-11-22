import { describe, it, expect } from 'vitest';
import { InvalidNameError } from '../errors/invalid-name.error.js';
import { Email } from '../value-objects/email.vo.js';
import { User } from './user.entity.js';

describe('User', () => {
  const email = Email.create('a@x.com');

  it('registra sem papéis e com o nome sem espaços nas pontas', () => {
    const user = User.register('u1', email, '  Ana Souza ', 'hash');
    expect(user.name).toBe('Ana Souza');
    expect(user.roles).toEqual([]);
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejeita nome inválido "%s"', (name) => {
    expect(() => User.register('u1', email, name, 'hash')).toThrow(InvalidNameError);
  });

  it('aceita nome com exatamente 100 caracteres', () => {
    expect(User.register('u1', email, 'x'.repeat(100), 'hash').name).toHaveLength(100);
  });
});
