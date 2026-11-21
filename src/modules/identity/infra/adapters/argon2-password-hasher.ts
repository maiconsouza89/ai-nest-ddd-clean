import * as argon2 from 'argon2';
import { PasswordHasher } from '../../application/ports/password-hasher';

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string) {
    return argon2.hash(plain); // argon2id com os parâmetros padrão da biblioteca
  }

  async verify(hash: string, plain: string) {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false; // hash malformado nunca autentica
    }
  }
}
