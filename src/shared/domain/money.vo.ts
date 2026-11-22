import { DomainError } from './domain-error.js';

export class InvalidMoneyError extends DomainError {
  readonly code = 'INVALID_MONEY';
  constructor() {
    super('Invalid money amount');
  }
}

export class CurrencyMismatchError extends DomainError {
  readonly code = 'CURRENCY_MISMATCH';
  constructor() {
    super('Cannot combine different currencies');
  }
}

export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}

  static fromCents(cents: number, currency = 'BRL') {
    if (!Number.isSafeInteger(cents)) throw new InvalidMoneyError();
    return new Money(cents, currency);
  }

  static zero(currency = 'BRL') {
    return new Money(0, currency);
  }

  add(o: Money) {
    this.assertSameCurrency(o);
    return new Money(this.cents + o.cents, this.currency);
  }

  times(qty: number) {
    if (!Number.isInteger(qty)) throw new InvalidMoneyError();
    return new Money(this.cents * qty, this.currency);
  }

  private assertSameCurrency(o: Money) {
    if (o.currency !== this.currency) throw new CurrencyMismatchError();
  }
}
