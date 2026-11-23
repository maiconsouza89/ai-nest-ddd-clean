import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { UuidV7Generator } from '#shared/infra/ids/uuid-v7.generator';
import { PasswordHasher } from '../application/ports/password-hasher.js';
import { TokenIssuer } from '../application/ports/token-issuer.js';
import { LoginUseCase } from '../application/use-cases/login.use-case.js';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case.js';
import { UserDirectoryFacade } from '../contracts/user-directory.facade.js';
import { UserRepository } from '../domain/repositories/user.repository.js';
import { Argon2PasswordHasher } from './adapters/argon2-password-hasher.js';
import { JwtTokenIssuer } from './adapters/jwt-token-issuer.js';
import { UserOrmEntity } from './database/typeorm/entities/user.orm-entity.js';
import { TypeOrmUserRepository } from './database/typeorm/typeorm-user.repository.js';
import { AuthController } from './http/controllers/auth.controller.js';
import { TypeOrmUserDirectoryFacade } from './typeorm-user-directory.facade.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [AuthController],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: UserDirectoryFacade, useClass: TypeOrmUserDirectoryFacade },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    {
      provide: TokenIssuer,
      useFactory: (jwt: JwtService, config: ConfigService<EnvironmentVariables, true>) =>
        new JwtTokenIssuer(jwt, config.getOrThrow('JWT_ACCESS_TTL_SECONDS', { infer: true })),
      inject: [JwtService, ConfigService],
    },
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
  exports: [UserDirectoryFacade], // nada além da facade sai do módulo (ADR 0003)
})
export class IdentityModule {}
