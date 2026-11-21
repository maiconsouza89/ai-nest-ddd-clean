import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email.vo';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error';
import { LoginInput } from '../dtos/identity.inputs';
import { PasswordHasher } from '../ports/password-hasher';
import { TokenIssuer } from '../ports/token-issuer';

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput) {
    const user = await this.users.findByEmail(this.parseEmail(input.email));
    // mesma resposta para e-mail desconhecido e senha errada
    if (!user || !(await this.hasher.verify(user.passwordHash, input.password))) {
      throw new InvalidCredentialsError();
    }
    const accessToken = await this.tokens.issue({ sub: user.id, roles: [...user.roles] });
    return { accessToken };
  }

  private parseEmail(raw: string) {
    try {
      return Email.create(raw);
    } catch (e) {
      if (e instanceof InvalidEmailError) throw new InvalidCredentialsError();
      throw e;
    }
  }
}
