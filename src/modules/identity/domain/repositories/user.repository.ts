import { Email } from '../value-objects/email.vo.js';
import { User } from '../entities/user.entity.js';

export abstract class UserRepository {
  /** Lança EmailAlreadyInUseError se o e-mail já existir (garantido por UNIQUE no banco). */
  abstract save(user: User): Promise<void>;
  abstract findByEmail(email: Email): Promise<User | null>;
  /**
   * O usuário pelo id, travado até o fim da transação: quem o grava de volta não desfaz uma mudança
   * feita no meio. Chame dentro de uma transação.
   */
  abstract findByIdForUpdate(id: string): Promise<User | null>;
}
