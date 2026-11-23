import { RefreshToken } from '../entities/refresh-token.entity.js';

export abstract class RefreshTokenRepository {
  abstract add(token: RefreshToken): Promise<void>;
  abstract findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /**
   * Marca o token como usado de forma atômica, só se ele ainda não foi usado, não foi revogado e
   * não venceu. Devolve false caso contrário: reuso, outra renovação com o mesmo token chegou
   * antes, ou a família foi revogada depois que o token foi lido.
   */
  abstract markUsed(id: string, at: Date): Promise<boolean>;
  /**
   * Revoga todos os tokens da família, inclusive o sucessor que uma renovação concorrente esteja
   * gravando. Chame dentro de uma transação.
   */
  abstract revokeFamily(familyId: string, at: Date): Promise<void>;
  /** Apaga até `limit` tokens vencidos e devolve quantos saíram. */
  abstract deleteExpired(now: Date, limit: number): Promise<number>;
}
