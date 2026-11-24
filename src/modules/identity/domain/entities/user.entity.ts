import { AggregateRoot } from '#shared/domain/aggregate-root';
import { InvalidNameError } from '../errors/invalid-name.error.js';
import { EmailVerified } from '../events/email-verified.event.js';
import { Email } from '../value-objects/email.vo.js';

const MAX_NAME_LENGTH = 100;

export type UserProps = {
  id: string;
  email: Email;
  name: string;
  passwordHash: string;
  roles: string[];
  emailVerifiedAt: Date | null;
};

export class User extends AggregateRoot {
  private constructor(
    readonly id: string,
    readonly email: Email,
    readonly name: string,
    readonly passwordHash: string,
    private readonly _roles: string[],
    private _emailVerifiedAt: Date | null,
  ) {
    super();
  }

  // um cadastro novo nunca recebe papéis (privilégios são concedidos por outro caminho) e nasce
  // com o e-mail por verificar
  static register(id: string, email: Email, name: string, passwordHash: string) {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) throw new InvalidNameError();
    return new User(id, email, trimmed, passwordHash, [], null);
  }

  static restore(p: UserProps) {
    return new User(p.id, p.email, p.name, p.passwordHash, p.roles, p.emailVerifiedAt);
  }

  get roles(): readonly string[] {
    return [...this._roles];
  }

  get emailVerifiedAt() {
    return this._emailVerifiedAt;
  }

  get isEmailVerified() {
    return this._emailVerifiedAt !== null;
  }

  /** Marca o e-mail como verificado. Repetir não muda a data nem anota o evento de novo. */
  verifyEmail(now: Date) {
    if (this.isEmailVerified) return;
    this._emailVerifiedAt = now;
    this.addDomainEvent(new EmailVerified(this.id, this.email.value, this.name));
  }
}
