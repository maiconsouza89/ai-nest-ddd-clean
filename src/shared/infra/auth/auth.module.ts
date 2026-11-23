import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

type AuthModuleOptions = {
  /** Módulos que fornecem o `ActorResolver`. Quem os passa é o AppModule, a raiz de composição. */
  imports: NonNullable<ModuleMetadata['imports']>;
};

// O shared não importa o identity: o ActorResolver chega pelos `imports` (ADR 0002).
@Module({})
export class AuthModule {
  static forRoot({ imports }: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      imports,
      providers: [
        // a ordem importa: autentica primeiro, depois checa os papéis
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    };
  }
}
