import { InvalidNameError } from '../errors/invalid-name.error.js';
import { Email } from '../value-objects/email.vo.js';

const MAX_NAME_LENGTH = 100;

export type UserProps = {
  id: string;
  email: Email;
  name: string;
  passwordHash: string;
  roles: string[];
};

export class User {
  private constructor(
    readonly id: string,
    readonly email: Email,
    readonly name: string,
    readonly passwordHash: string,
    private readonly _roles: string[],
  ) {}

  // um cadastro novo nunca recebe papéis: privilégios são concedidos por outro caminho
  static register(id: string, email: Email, name: string, passwordHash: string) {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) throw new InvalidNameError();
    return new User(id, email, trimmed, passwordHash, []);
  }

  static restore(p: UserProps) {
    return new User(p.id, p.email, p.name, p.passwordHash, p.roles);
  }

  get roles(): readonly string[] {
    return [...this._roles];
  }
}
