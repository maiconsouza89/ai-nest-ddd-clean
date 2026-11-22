import { User } from '../../../domain/entities/user.entity.js';
import { EmailAlreadyInUseError } from '../../../domain/errors/email-already-in-use.error.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';
import { Email } from '../../../domain/value-objects/email.vo.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async save(user: User) {
    const taken = [...this.users.values()].some(
      (u) => u.email.value === user.email.value && u.id !== user.id,
    );
    if (taken) throw new EmailAlreadyInUseError();
    this.users.set(user.id, user);
  }

  async findByEmail(email: Email) {
    return [...this.users.values()].find((u) => u.email.value === email.value) ?? null;
  }
}
