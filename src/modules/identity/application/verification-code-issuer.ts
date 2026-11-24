import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Outbox } from '#shared/application/ports/outbox';
import { VerificationCodeIssuedV1 } from '../contracts/events/verification-code-issued.event.js';
import { User } from '../domain/entities/user.entity.js';
import { VerificationCode } from '../domain/entities/verification-code.entity.js';
import { VerificationCodeRepository } from '../domain/repositories/verification-code.repository.js';
import { VerificationCodeGenerator } from './ports/verification-code-generator.js';

/**
 * Emite um código de verificação: grava o hash, invalida os anteriores e publica o código em texto
 * puro no `identity.verification-code-issued`, para o notifications enviar. O código não vem de um
 * evento de domínio porque a entidade só conhece o hash.
 */
export class VerificationCodeIssuer {
  constructor(
    private readonly codes: VerificationCodeRepository,
    private readonly generator: VerificationCodeGenerator,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly ttlMs: number,
  ) {}

  /** Chame dentro de uma transação, a mesma de quem grava o usuário, se for o caso. */
  async issue(user: User) {
    const now = this.clock.now();
    const plain = this.generator.generate();
    const code = VerificationCode.issue(
      { id: this.ids.next(), userId: user.id, codeHash: this.generator.hash(plain) },
      now,
      this.ttlMs,
    );
    await this.codes.add(code);
    const event: VerificationCodeIssuedV1 = {
      eventId: this.ids.next(),
      type: 'identity.verification-code-issued',
      version: 1,
      occurredAt: now.toISOString(),
      payload: {
        userId: user.id,
        email: user.email.value,
        name: user.name,
        code: plain,
        expiresAt: code.expiresAt.toISOString(),
      },
    };
    await this.outbox.add(user.id, [event]);
  }
}
