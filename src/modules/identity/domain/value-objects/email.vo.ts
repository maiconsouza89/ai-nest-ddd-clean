import { InvalidEmailError } from '../errors/invalid-email.error.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string) {
    const email = Email.tryCreate(raw);
    if (!email) throw new InvalidEmailError();
    return email;
  }

  /** Para quem só busca pelo e-mail: um endereço inválido não existe, e a resposta é a de "não achei". */
  static tryCreate(raw: string) {
    const value = raw.trim().toLowerCase();
    return value.length > 254 || !EMAIL_PATTERN.test(value) ? null : new Email(value);
  }
}
