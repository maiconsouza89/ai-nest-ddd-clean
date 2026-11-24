import { Clock } from '#shared/application/ports/clock';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { CODE_QUOTA } from '../../domain/entities/verification-code.entity.js';
import { VerificationCodeRepository } from '../../domain/repositories/verification-code.repository.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { ResendVerificationCodeInput } from '../dtos/identity.inputs.js';
import { VerificationCodeIssuer } from '../verification-code-issuer.js';

/**
 * Emite um código novo, que invalida o anterior. E-mail desconhecido, conta já verificada, pedido
 * antes do intervalo mínimo e cota de códigos esgotada terminam em silêncio: quem chama recebe sempre a mesma resposta, sem
 * saber se a conta existe nem se o e-mail saiu.
 */
export class ResendVerificationCodeUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly codes: VerificationCodeRepository,
    private readonly issuer: VerificationCodeIssuer,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
  ) {}

  async execute(input: ResendVerificationCodeInput) {
    const email = Email.tryCreate(input.email);
    const found = email && (await this.users.findByEmail(email));
    if (!found || found.isEmailVerified) return;

    await this.tx.run(async () => {
      // a trava do usuário enfileira o reenvio com outro reenvio e com a verificação: relido, ele
      // já mostra o código emitido ou a verificação que terminou antes
      const user = await this.users.findByIdForUpdate(found.id);
      if (!user || user.isEmailVerified) return;
      const latest = await this.codes.findLatestForUpdate(user.id);
      const now = this.clock.now();
      if (latest && !latest.allowsResendAt(now)) return;
      // a cota por conta, e não só por IP: cada código novo traz mais tentativas
      const since = new Date(now.getTime() - CODE_QUOTA.windowMs);
      if ((await this.codes.countIssuedSince(user.id, since)) >= CODE_QUOTA.max) return;
      await this.issuer.issue(user);
    });
  }
}
