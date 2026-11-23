import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation.js';

/** Exportado para os testes do guard usarem a mesma configuração da aplicação. */
export const jwtModuleOptions = (secret: string): JwtModuleOptions => ({
  secret,
  signOptions: { algorithm: 'HS256' },
  verifyOptions: { algorithms: ['HS256'] }, // nunca aceita o algoritmo que o token declarar
});

// Um só JwtModule para assinar (identity) e verificar (guard), com o mesmo segredo. A validade do
// token fica com quem o emite (o TokenIssuer do identity), que também a devolve no login.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<EnvironmentVariables, true>) =>
        jwtModuleOptions(cfg.getOrThrow('JWT_SECRET')),
    }),
  ],
  exports: [JwtModule],
})
export class JwtConfigModule {}
