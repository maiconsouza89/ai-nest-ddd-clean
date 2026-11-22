import { InvalidEmailError } from '../errors/invalid-email.error.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string) {
    const value = raw.trim().toLowerCase();
    if (value.length > 254 || !EMAIL_PATTERN.test(value)) throw new InvalidEmailError();
    return new Email(value);
  }
}
