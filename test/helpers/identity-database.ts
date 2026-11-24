import { RefreshTokenOrmEntity } from '#modules/identity/infra/database/typeorm/entities/refresh-token.orm-entity';
import { UserOrmEntity } from '#modules/identity/infra/database/typeorm/entities/user.orm-entity';
import { VerificationCodeOrmEntity } from '#modules/identity/infra/database/typeorm/entities/verification-code.orm-entity';
import { CreateIdentitySchema1795238174857 } from '#modules/identity/infra/database/typeorm/migrations/1795238174857-create-identity-schema';
import { CreateIdentityUsers1795238176955 } from '#modules/identity/infra/database/typeorm/migrations/1795238176955-create-identity-users';
import { AddUserName1795238354345 } from '#modules/identity/infra/database/typeorm/migrations/1795238354345-add-user-name';
import { CreateIdentityRefreshTokens1795438796292 } from '#modules/identity/infra/database/typeorm/migrations/1795438796292-create-identity-refresh-tokens';
import { AddEmailVerification1795545972474 } from '#modules/identity/infra/database/typeorm/migrations/1795545972474-add-email-verification';
import { startDatabase } from './database.js';
import { outboxEntities, outboxMigrations } from './outbox-database.js';

export const startIdentityDatabase = () =>
  startDatabase({
    // o identity também grava na outbox compartilhada
    entities: [UserOrmEntity, RefreshTokenOrmEntity, VerificationCodeOrmEntity, ...outboxEntities],
    migrations: [
      CreateIdentitySchema1795238174857,
      CreateIdentityUsers1795238176955,
      AddUserName1795238354345,
      CreateIdentityRefreshTokens1795438796292,
      AddEmailVerification1795545972474,
      ...outboxMigrations,
    ],
    migrationsTableName: 'identity_migrations',
  });
