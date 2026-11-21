import { describe, it, expect } from 'vitest';
import { InvalidEmailError } from '../errors/invalid-email.error';
import { Email } from './email.vo';

describe('Email', () => {
  it('normaliza espaços e caixa', () => {
    expect(Email.create('  Ana@Example.COM ').value).toBe('ana@example.com');
  });

  it.each(['', 'sem-arroba', 'a@b', 'a b@c.com', '@c.com'])('rejeita "%s"', (raw) => {
    expect(() => Email.create(raw)).toThrow(InvalidEmailError);
  });
});
