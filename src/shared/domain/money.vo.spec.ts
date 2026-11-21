import { describe, it, expect } from 'vitest';
import { CurrencyMismatchError, InvalidMoneyError, Money } from './money.vo';

describe('Money', () => {
  it('soma valores na mesma moeda', () => {
    const sum = Money.fromCents(10).add(Money.fromCents(20));
    expect(sum.cents).toBe(30);
    expect(sum.currency).toBe('BRL');
  });

  it('multiplica por quantidade inteira', () => {
    expect(Money.fromCents(250).times(3).cents).toBe(750);
  });

  it('rejeita quantidade não inteira em times', () => {
    expect(() => Money.fromCents(100).times(1.5)).toThrow(InvalidMoneyError);
  });

  it('rejeita centavos não inteiros', () => {
    expect(() => Money.fromCents(0.5)).toThrow(InvalidMoneyError);
  });

  it('rejeita soma de moedas diferentes', () => {
    expect(() => Money.fromCents(10, 'BRL').add(Money.fromCents(10, 'USD'))).toThrow(
      CurrencyMismatchError,
    );
  });

  it('zero é elemento neutro da soma', () => {
    expect(Money.zero().add(Money.fromCents(5)).cents).toBe(5);
  });
});
