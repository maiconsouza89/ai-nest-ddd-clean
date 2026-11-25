import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';
import { provideErrorStatuses } from '#shared/infra/http/error-status.registry';
import { UuidV7Generator } from '#shared/infra/ids/uuid-v7.generator';
import { MessagingModule } from '#shared/infra/messaging/messaging.module';
import { Outbox } from '#shared/application/ports/outbox';
import { OpaqueTokenGenerator } from '../application/ports/opaque-token-generator.js';
import { PasswordHasher } from '../application/ports/password-hasher.js';
import { TokenIssuer } from '../application/ports/token-issuer.js';
import { VerificationCodeGenerator } from '../application/ports/verification-code-generator.js';
import { VerificationCodeIssuer } from '../application/verification-code-issuer.js';
import { ResendVerificationCodeUseCase } from '../application/use-cases/resend-verification-code.use-case.js';
import { VerifyEmailUseCase } from '../application/use-cases/verify-email.use-case.js';
import { SessionIssuer } from '../application/session-issuer.js';
import { LoginUseCase } from '../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../application/use-cases/logout.use-case.js';
import { PurgeExpiredRefreshTokensUseCase } from '../application/use-cases/purge-expired-refresh-tokens.use-case.js';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case.js';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case.js';
import { UserDirectoryFacade } from '../contracts/user-directory.facade.js';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token.repository.js';
import { UserRepository } from '../domain/repositories/user.repository.js';
import { VerificationCodeRepository } from '../domain/repositories/verification-code.repository.js';
import { Argon2PasswordHasher } from './adapters/argon2-password-hasher.js';
import { CryptoOpaqueTokenGenerator } from './adapters/crypto-opaque-token-generator.js';
import { JwtTokenIssuer } from './adapters/jwt-token-issuer.js';
import { CryptoVerificationCodeGenerator } from './adapters/crypto-verification-code-generator.js';
import { RefreshTokenOrmEntity } from './database/typeorm/entities/refresh-token.orm-entity.js';
import { UserOrmEntity } from './database/typeorm/entities/user.orm-entity.js';
import { VerificationCodeOrmEntity } from './database/typeorm/entities/verification-code.orm-entity.js';
import { TypeOrmRefreshTokenRepository } from './database/typeorm/typeorm-refresh-token.repository.js';
import { TypeOrmUserRepository } from './database/typeorm/typeorm-user.repository.js';
import { TypeOrmVerificationCodeRepository } from './database/typeorm/typeorm-verification-code.repository.js';
import { AuthController } from './http/controllers/auth.controller.js';
import { IDENTITY_ERROR_STATUSES } from './http/error-statuses.js';
import { PurgeExpiredRefreshTokensProcessor } from './jobs/purge-expired-refresh-tokens.processor.js';
import { TypeOrmUserDirectoryFacade } from './adapters/typeorm-user-directory.facade.js';

type Config = ConfigService<EnvironmentVariables, true>;

@Module({
  imports: [
    MessagingModule,
    TypeOrmModule.forFeature([UserOrmEntity, RefreshTokenOrmEntity, VerificationCodeOrmEntity]),
  ],
  controllers: [AuthController],
  providers: [
    provideErrorStatuses(IDENTITY_ERROR_STATUSES),
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: RefreshTokenRepository, useClass: TypeOrmRefreshTokenRepository },
    { provide: VerificationCodeRepository, useClass: TypeOrmVerificationCodeRepository },
    { provide: UserDirectoryFacade, useClass: TypeOrmUserDirectoryFacade },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: OpaqueTokenGenerator, useClass: CryptoOpaqueTokenGenerator },
    { provide: VerificationCodeGenerator, useClass: CryptoVerificationCodeGenerator },
    {
      provide: TokenIssuer,
      useFactory: (jwt: JwtService, config: Config) =>
        new JwtTokenIssuer(jwt, config.getOrThrow('JWT_ACCESS_TTL_SECONDS', { infer: true })),
      inject: [JwtService, ConfigService],
    },
    { provide: IdGenerator, useClass: UuidV7Generator },
    {
      provide: SessionIssuer,
      useFactory: (
        tokens: TokenIssuer,
        refreshTokens: RefreshTokenRepository,
        secrets: OpaqueTokenGenerator,
        ids: IdGenerator,
        clock: Clock,
        config: Config,
      ) =>
        new SessionIssuer(tokens, refreshTokens, secrets, ids, clock, {
          ttlMs: config.getOrThrow('REFRESH_TOKEN_TTL_SECONDS', { infer: true }) * 1000,
          familyMaxAgeMs:
            config.getOrThrow('REFRESH_FAMILY_MAX_AGE_SECONDS', { infer: true }) * 1000,
        }),
      inject: [
        TokenIssuer,
        RefreshTokenRepository,
        OpaqueTokenGenerator,
        IdGenerator,
        Clock,
        ConfigService,
      ],
    },
    {
      provide: VerificationCodeIssuer,
      useFactory: (
        codes: VerificationCodeRepository,
        generator: VerificationCodeGenerator,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        config: Config,
      ) =>
        new VerificationCodeIssuer(
          codes,
          generator,
          outbox,
          ids,
          clock,
          config.getOrThrow('EMAIL_VERIFICATION_CODE_TTL_SECONDS', { infer: true }) * 1000,
        ),
      inject: [
        VerificationCodeRepository,
        VerificationCodeGenerator,
        Outbox,
        IdGenerator,
        Clock,
        ConfigService,
      ],
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        ids: IdGenerator,
        tx: TransactionManager,
        codes: VerificationCodeIssuer,
      ) => new RegisterUserUseCase(users, hasher, ids, tx, codes),
      inject: [
        UserRepository,
        PasswordHasher,
        IdGenerator,
        TransactionManager,
        VerificationCodeIssuer,
      ],
    },
    {
      provide: ResendVerificationCodeUseCase,
      useFactory: (
        users: UserRepository,
        codes: VerificationCodeRepository,
        issuer: VerificationCodeIssuer,
        clock: Clock,
        tx: TransactionManager,
      ) => new ResendVerificationCodeUseCase(users, codes, issuer, clock, tx),
      inject: [
        UserRepository,
        VerificationCodeRepository,
        VerificationCodeIssuer,
        Clock,
        TransactionManager,
      ],
    },
    {
      provide: VerifyEmailUseCase,
      useFactory: (
        users: UserRepository,
        codes: VerificationCodeRepository,
        generator: VerificationCodeGenerator,
        outbox: Outbox,
        ids: IdGenerator,
        clock: Clock,
        tx: TransactionManager,
      ) => new VerifyEmailUseCase(users, codes, generator, outbox, ids, clock, tx),
      inject: [
        UserRepository,
        VerificationCodeRepository,
        VerificationCodeGenerator,
        Outbox,
        IdGenerator,
        Clock,
        TransactionManager,
      ],
    },
    {
      provide: LoginUseCase,
      useFactory: (users: UserRepository, hasher: PasswordHasher, sessions: SessionIssuer) =>
        new LoginUseCase(users, hasher, sessions),
      inject: [UserRepository, PasswordHasher, SessionIssuer],
    },
    {
      provide: RefreshSessionUseCase,
      useFactory: (
        refreshTokens: RefreshTokenRepository,
        secrets: OpaqueTokenGenerator,
        sessions: SessionIssuer,
        clock: Clock,
        tx: TransactionManager,
      ) => new RefreshSessionUseCase(refreshTokens, secrets, sessions, clock, tx),
      inject: [
        RefreshTokenRepository,
        OpaqueTokenGenerator,
        SessionIssuer,
        Clock,
        TransactionManager,
      ],
    },
    {
      provide: LogoutUseCase,
      useFactory: (
        refreshTokens: RefreshTokenRepository,
        secrets: OpaqueTokenGenerator,
        clock: Clock,
        tx: TransactionManager,
      ) => new LogoutUseCase(refreshTokens, secrets, clock, tx),
      inject: [RefreshTokenRepository, OpaqueTokenGenerator, Clock, TransactionManager],
    },
    {
      provide: PurgeExpiredRefreshTokensUseCase,
      useFactory: (refreshTokens: RefreshTokenRepository, clock: Clock) =>
        new PurgeExpiredRefreshTokensUseCase(refreshTokens, clock),
      inject: [RefreshTokenRepository, Clock],
    },
    PurgeExpiredRefreshTokensProcessor,
  ],
  exports: [UserDirectoryFacade], // nada além da facade sai do módulo (ADR 0003)
})
export class IdentityModule {}
