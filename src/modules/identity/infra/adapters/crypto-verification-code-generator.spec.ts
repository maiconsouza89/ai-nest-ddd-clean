import { describe, it, expect } from 'vitest';
import { CryptoVerificationCodeGenerator } from './crypto-verification-code-generator.js';

describe('CryptoVerificationCodeGenerator', () => {
  const generator = new CryptoVerificationCodeGenerator();

  it('gera seis dígitos, inclusive com zeros à esquerda', () => {
    for (let i = 0; i < 200; i++) expect(generator.generate()).toMatch(/^\d{6}$/);
  });

  it('o hash é determinístico e não é o código', () => {
    expect(generator.hash('012345')).toBe(generator.hash('012345'));
    expect(generator.hash('012345')).not.toBe('012345');
    expect(generator.hash('012345')).not.toBe(generator.hash('012346'));
  });
});
