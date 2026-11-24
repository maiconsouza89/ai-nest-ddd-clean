import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Outbox } from '#shared/application/ports/outbox';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { InvalidVerificationCodeError } from '../../domain/errors/invalid-verification-code.error.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { VerificationCodeRepository } from '../../domain/repositories/verification-code.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { publishUserEvents } from '../events/publish-user-events.js';
import { VerifyEmailInput } from '../dtos/identity.inputs.js';
import { VerificationCodeGenerator } from '../ports/verification-code-generator.js';

/**
 * Confere o código e marca o e-mail como verificado. Não abre sessão: o cliente faz login depois.
 * Código errado, vencido, usado ou esgotado e e-mail desconhecido dão o mesmo erro.
 */
export class VerifyEmailUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly codes: VerificationCodeRepository,
    private readonly generator: VerificationCodeGenerator,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
  ) {}

  async execute(input: VerifyEmailInput) {
    const email = Email.tryCreate(input.email);
    const found = email && (await this.users.findByEmail(email));
    if (!found) throw new InvalidVerificationCodeError();

    const verified = await this.tx.run(async () => {
      // relido com trava: o save grava todas as colunas e não pode desfazer uma mudança feita no
      // meio (roles, por exemplo). A trava também faz tentativas simultâneas contarem uma a uma.
      const user = await this.users.findByIdForUpdate(found.id);
      if (!user) return false;
      const code = await this.codes.findLatestForUpdate(user.id);
      if (!code) return false;
      const now = this.clock.now();
      const ok = code.verify(this.generator.hash(input.code), now);
      await this.codes.save(code);
      if (!ok) return false;
      user.verifyEmail(now);
      await this.users.save(user);
      await publishUserEvents(user, { outbox: this.outbox, ids: this.ids, clock: this.clock });
      return true;
    });
    // fora da transação: lançar dentro dela desfaria a contagem da tentativa errada
    if (!verified) throw new InvalidVerificationCodeError();
  }
}
