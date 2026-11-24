import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { Trim } from './trim.decorator.js';

class Body {
  @Trim()
  name!: unknown;
}

const transform = (name: unknown) => plainToInstance(Body, { name }).name;

describe('Trim', () => {
  it('tira os espaços das pontas de uma string', () => {
    expect(transform('  Ana Maria  ')).toBe('Ana Maria');
  });

  it('reduz uma string só de espaços a vazia', () => {
    expect(transform('   ')).toBe('');
  });

  it('deixa passar sem mudança um valor que não é string', () => {
    expect(transform(42)).toBe(42);
    expect(transform(null)).toBeNull();
    expect(transform(['  a  '])).toEqual(['  a  ']);
  });
});
