import { describe, it, expect } from 'vitest';
import { InvalidNameError } from '../errors/invalid-name.error.js';
import { EmailVerified } from '../events/email-verified.event.js';
import { Email } from '../value-objects/email.vo.js';
import { User } from './user.entity.js';

describe('User', () => {
  const email = Email.create('a@x.com');

  it('registra sem papéis, com o nome sem espaços nas pontas e com o e-mail por verificar', () => {
    const user = User.register('u1', email, '  Ana Souza ', 'hash');
    expect(user.name).toBe('Ana Souza');
    expect(user.roles).toEqual([]);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.isEmailVerified).toBe(false);
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejeita nome inválido "%s"', (name) => {
    expect(() => User.register('u1', email, name, 'hash')).toThrow(InvalidNameError);
  });

  it('aceita nome com exatamente 100 caracteres', () => {
    expect(User.register('u1', email, 'x'.repeat(100), 'hash').name).toHaveLength(100);
  });

  describe('verifyEmail', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');

    it('marca a data e anota EmailVerified', () => {
      const user = User.register('u1', email, 'Ana', 'hash');
      user.verifyEmail(now);
      expect(user.emailVerifiedAt).toEqual(now);
      expect(user.isEmailVerified).toBe(true);
      expect(user.pullDomainEvents()).toEqual([new EmailVerified('u1', 'a@x.com', 'Ana')]);
    });

    it('repetir não muda a data nem anota o evento de novo', () => {
      const user = User.register('u1', email, 'Ana', 'hash');
      user.verifyEmail(now);
      user.pullDomainEvents();

      user.verifyEmail(new Date('2026-01-02T00:00:00.000Z'));

      expect(user.emailVerifiedAt).toEqual(now);
      expect(user.pullDomainEvents()).toEqual([]);
    });
  });
});
