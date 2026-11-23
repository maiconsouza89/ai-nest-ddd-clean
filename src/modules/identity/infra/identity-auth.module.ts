import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActorResolver } from '#shared/application/ports/actor-resolver';
import { UserOrmEntity } from './database/typeorm/entities/user.orm-entity.js';
import { TypeOrmActorResolver } from './typeorm-actor-resolver.js';

// Separado do IdentityModule, que exporta só a facade (ADR 0003). Só o AppModule importa este
// módulo, para entregá-lo ao AuthModule.forRoot.
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  providers: [{ provide: ActorResolver, useClass: TypeOrmActorResolver }],
  exports: [ActorResolver],
})
export class IdentityAuthModule {}
