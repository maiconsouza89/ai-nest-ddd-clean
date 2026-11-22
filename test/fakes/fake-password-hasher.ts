import { PasswordHasher } from '#modules/identity/application/ports/password-hasher';

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async verify(hash: string, plain: string) {
    return hash === `hashed:${plain}`;
  }
}
