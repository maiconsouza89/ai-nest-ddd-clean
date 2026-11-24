export type VerificationCodeProps = {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
};

/** Tentativas erradas que um código aceita antes de ficar esgotado. */
export const MAX_VERIFICATION_ATTEMPTS = 5;

/** Intervalo mínimo entre dois códigos do mesmo usuário. */
export const RESEND_INTERVAL_MS = 60_000;

/**
 * O código que verifica o e-mail de um usuário. Vale por um prazo, aceita poucas tentativas erradas
 * e é de uso único. A entidade só conhece o hash: o código em texto puro existe apenas na emissão.
 */
export class VerificationCode {
  private constructor(private readonly props: VerificationCodeProps) {}

  static issue(code: { id: string; userId: string; codeHash: string }, now: Date, ttlMs: number) {
    return new VerificationCode({
      ...code,
      expiresAt: new Date(now.getTime() + ttlMs),
      attempts: 0,
      usedAt: null,
      createdAt: now,
    });
  }

  static restore(props: VerificationCodeProps) {
    return new VerificationCode({ ...props });
  }

  /** Cópia do estado, para a persistência gravar. */
  toProps(): VerificationCodeProps {
    return { ...this.props };
  }

  /** Não venceu, não foi usado e não esgotou as tentativas. */
  acceptsAttemptsAt(now: Date) {
    return (
      this.props.usedAt === null &&
      now < this.props.expiresAt &&
      this.props.attempts < MAX_VERIFICATION_ATTEMPTS
    );
  }

  /** Já passou o intervalo mínimo desde esta emissão, e um código novo pode substituí-lo. */
  allowsResendAt(now: Date) {
    return now.getTime() - this.props.createdAt.getTime() >= RESEND_INTERVAL_MS;
  }

  /**
   * Confere o hash de um código informado. No acerto, marca o uso. No erro, conta a tentativa.
   * Um código que já não aceita tentativas recusa até o valor certo, sem mudar de estado.
   */
  verify(codeHash: string, now: Date) {
    if (!this.acceptsAttemptsAt(now)) return false;
    if (codeHash !== this.props.codeHash) {
      this.props.attempts++;
      return false;
    }
    this.props.usedAt = now;
    return true;
  }

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get expiresAt() {
    return this.props.expiresAt;
  }
  get attempts() {
    return this.props.attempts;
  }
  get usedAt() {
    return this.props.usedAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}
