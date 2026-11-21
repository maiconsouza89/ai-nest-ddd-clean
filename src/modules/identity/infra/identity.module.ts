import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { TransactionManager } from '../../../shared/application/ports/transaction-manager';
import { UuidV7Generator } from '../../../shared/infra/ids/uuid-v7.generator';
import { PasswordHasher } from '../application/ports/password-hasher';
import { TokenIssuer } from '../application/ports/token-issuer';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { UserRepository } from '../domain/repositories/user.repository';
import { Argon2PasswordHasher } from './adapters/argon2-password-hasher';
import { JwtTokenIssuer } from './adapters/jwt-token-issuer';
import { UserOrmEntity } from './database/typeorm/entities/user.orm-entity';
import { TypeOrmUserRepository } from './database/typeorm/typeorm-user.repository';
import { AuthController } from './http/controllers/auth.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [AuthController],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: TokenIssuer, useClass: JwtTokenIssuer },
    { provide: IdGenerator, useClass: UuidV7Generator },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        ids: IdGenerator,
        tx: TransactionManager,
      ) => new RegisterUserUseCase(users, hasher, ids, tx),
      inject: [UserRepository, PasswordHasher, IdGenerator, TransactionManager],
    },
    {
      provide: LoginUseCase,
      useFactory: (users: UserRepository, hasher: PasswordHasher, tokens: TokenIssuer) =>
        new LoginUseCase(users, hasher, tokens),
      inject: [UserRepository, PasswordHasher, TokenIssuer],
    },
  ],
})
export class IdentityModule {}
