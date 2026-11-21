import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../../shared/application/ports/transaction-manager';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyInUseError } from '../../domain/errors/email-already-in-use.error';
import { UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email.vo';
import { RegisterUserInput } from '../dtos/identity.inputs';
import { PasswordHasher } from '../ports/password-hasher';

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly tx: TransactionManager,
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
    await this.tx.run(() => this.users.save(user));
    return { id: user.id };
  }
}
