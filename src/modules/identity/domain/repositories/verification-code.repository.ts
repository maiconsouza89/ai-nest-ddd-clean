import { VerificationCode } from '../entities/verification-code.entity.js';

export abstract class VerificationCodeRepository {
  /**
   * Grava o código novo e marca como usados os anteriores do mesmo usuário: só o mais recente vale.
   * Chame dentro de uma transação.
   */
  abstract add(code: VerificationCode): Promise<void>;
  /**
   * O código mais recente do usuário, ou null. Trava a linha até o fim da transação, para duas
   * tentativas simultâneas não contarem do mesmo número. Chame dentro de uma transação.
   */
  abstract findLatestForUpdate(userId: string): Promise<VerificationCode | null>;
  /** Grava as tentativas e o uso. */
  abstract save(code: VerificationCode): Promise<void>;
}
