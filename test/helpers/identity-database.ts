import { UserOrmEntity } from '#modules/identity/infra/database/typeorm/entities/user.orm-entity';
import { CreateIdentitySchema1795238174857 } from '#modules/identity/infra/database/typeorm/migrations/1795238174857-create-identity-schema';
import { CreateIdentityUsers1795238176955 } from '#modules/identity/infra/database/typeorm/migrations/1795238176955-create-identity-users';
import { AddUserName1795238354345 } from '#modules/identity/infra/database/typeorm/migrations/1795238354345-add-user-name';
import { startDatabase } from './database.js';

export const startIdentityDatabase = () =>
  startDatabase({
    entities: [UserOrmEntity],
    migrations: [
      CreateIdentitySchema1795238174857,
      CreateIdentityUsers1795238176955,
      AddUserName1795238354345,
    ],
    migrationsTableName: 'identity_migrations',
  });
