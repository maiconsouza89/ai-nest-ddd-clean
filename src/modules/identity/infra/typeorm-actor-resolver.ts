import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { Actor } from '#shared/application/actor';
import { ActorResolver } from '#shared/application/ports/actor-resolver';
import { UserOrmEntity } from './database/typeorm/entities/user.orm-entity.js';

// Roda em toda requisição autenticada: uma leitura por PK, só com as colunas do ator.
@Injectable()
export class TypeOrmActorResolver implements ActorResolver {
  constructor(@InjectRepository(UserOrmEntity) private readonly users: Repository<UserOrmEntity>) {}

  async resolve(userId: string): Promise<Actor | null> {
    // o banco recusaria a consulta com um id que não é uuid
    if (!isUUID(userId)) return null;
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, roles: true },
    });
    return user ? { id: user.id, roles: user.roles } : null;
  }
}
