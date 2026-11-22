import { Email } from '../value-objects/email.vo.js';
import { User } from '../entities/user.entity.js';

export abstract class UserRepository {
  /** Lança EmailAlreadyInUseError se o e-mail já existir (garantido por UNIQUE no banco). */
  abstract save(user: User): Promise<void>;
  abstract findByEmail(email: Email): Promise<User | null>;
}
