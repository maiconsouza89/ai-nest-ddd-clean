import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { UserOrmEntity } from './entities/user.orm-entity.js';

export class UserMapper {
  static toDomain(raw: UserOrmEntity): User {
    return User.restore({
      id: raw.id,
      email: Email.create(raw.email),
      name: raw.name,
      passwordHash: raw.passwordHash,
      roles: raw.roles,
      emailVerifiedAt: raw.emailVerifiedAt,
    });
  }

  static toPersistence(user: User): UserOrmEntity {
    const raw = new UserOrmEntity();
    raw.id = user.id;
    raw.email = user.email.value;
    raw.name = user.name;
    raw.passwordHash = user.passwordHash;
    raw.roles = [...user.roles];
    raw.emailVerifiedAt = user.emailVerifiedAt;
    return raw;
  }
}
