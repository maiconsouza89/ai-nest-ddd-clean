import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

// Um só JwtModule para assinar (identity) e verificar (guard), com o mesmo segredo.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<EnvironmentVariables, true>) => ({
        secret: cfg.getOrThrow('JWT_SECRET'),
        signOptions: { algorithm: 'HS256', expiresIn: cfg.getOrThrow('JWT_EXPIRES_IN_SECONDS') },
        verifyOptions: { algorithms: ['HS256'] }, // nunca aceita o algoritmo que o token declarar
      }),
    }),
  ],
  providers: [
    // a ordem importa: autentica primeiro, depois checa os papéis
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
