import { EmailNotVerifiedError } from '../../domain/errors/email-not-verified.error.js';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { LoginInput } from '../dtos/identity.inputs.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { SessionIssuer } from '../session-issuer.js';

export class LoginUseCase {
  // hash descartável, gerado uma vez: igualaliza o tempo quando o e-mail não existe
  private decoyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: LoginInput) {
    const email = Email.tryCreate(input.email);
    if (!email) throw new InvalidCredentialsError();
    const user = await this.users.findByEmail(email);

    // sempre paga o custo de uma verificação, exista o usuário ou não, para que o tempo
    // de resposta não revele quais e-mails estão cadastrados
    const hash = user?.passwordHash ?? (await this.getDecoyHash());
    const passwordOk = await this.hasher.verify(hash, input.password);

    // mesma resposta para e-mail desconhecido e senha errada
    if (!user || !passwordOk) throw new InvalidCredentialsError();
    // só depois da senha: sem ela, a resposta não revela se a conta existe nem se foi verificada
    if (!user.isEmailVerified) throw new EmailNotVerifiedError();

    return this.sessions.start(user.id);
  }

  private getDecoyHash() {
    this.decoyHash ??= this.hasher.hash(crypto.randomUUID());
    return this.decoyHash;
  }
}
