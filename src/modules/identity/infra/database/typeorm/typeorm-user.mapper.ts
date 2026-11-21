import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserOrmEntity } from './entities/user.orm-entity';

export class UserMapper {
  static toDomain(raw: UserOrmEntity): User {
    return User.restore({
      id: raw.id,
      email: Email.create(raw.email),
      name: raw.name,
      passwordHash: raw.passwordHash,
      roles: raw.roles,
    });
  }

  static toPersistence(user: User): UserOrmEntity {
    const raw = new UserOrmEntity();
    raw.id = user.id;
    raw.email = user.email.value;
    raw.name = user.name;
    raw.passwordHash = user.passwordHash;
    raw.roles = [...user.roles];
    return raw;
  }
}
