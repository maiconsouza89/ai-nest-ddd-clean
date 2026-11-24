import { IdGenerator } from '#shared/application/ports/id-generator';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { User } from '../../domain/entities/user.entity.js';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { RegisterUserInput } from '../dtos/identity.inputs.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { VerificationCodeIssuer } from '../verification-code-issuer.js';

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly tx: TransactionManager,
    private readonly codes: VerificationCodeIssuer,
  ) {}

  async execute(input: RegisterUserInput) {
    const email = Email.create(input.email);

    // 1º nível: resposta rápida. O 2º nível é o UNIQUE do banco, que vence a corrida.
    if (await this.users.findByEmail(email)) throw new EmailAlreadyInUseError();

    const user = User.register(
      this.ids.next(),
      email,
      input.name,
      await this.hasher.hash(input.password),
    );
    // usuário, código e evento juntos: se um falhar, nenhum e-mail sai para uma conta que não existe
    await this.tx.run(async () => {
      await this.users.save(user);
      await this.codes.issue(user);
    });
    return { id: user.id };
  }
}
