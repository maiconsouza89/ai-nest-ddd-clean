import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error.js';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { LoginInput } from '../dtos/identity.inputs.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { TokenIssuer } from '../ports/token-issuer.js';

export class LoginUseCase {
  // hash descartável, gerado uma vez: igualaliza o tempo quando o e-mail não existe
  private decoyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput) {
    const user = await this.users.findByEmail(this.parseEmail(input.email));

    // sempre paga o custo de uma verificação, exista o usuário ou não, para que o tempo
    // de resposta não revele quais e-mails estão cadastrados
    const hash = user?.passwordHash ?? (await this.getDecoyHash());
    const passwordOk = await this.hasher.verify(hash, input.password);

    // mesma resposta para e-mail desconhecido e senha errada
    if (!user || !passwordOk) throw new InvalidCredentialsError();

    const accessToken = await this.tokens.issue({ sub: user.id, roles: [...user.roles] });
    return { accessToken };
  }

  private getDecoyHash() {
    this.decoyHash ??= this.hasher.hash(crypto.randomUUID());
    return this.decoyHash;
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
