import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { UserDirectoryFacade } from '../../contracts/user-directory.facade.js';
import { UserOrmEntity } from '../database/typeorm/entities/user.orm-entity.js';

@Injectable()
export class TypeOrmUserDirectoryFacade implements UserDirectoryFacade {
  constructor(@InjectRepository(UserOrmEntity) private readonly users: Repository<UserOrmEntity>) {}

  async emailOf(userId: string) {
    // o id vem de outro módulo e pode não ser um uuid válido; o banco recusaria a consulta
    if (!isUUID(userId)) return null;
    const user = await this.users.findOne({ where: { id: userId }, select: { email: true } });
    return user?.email ?? null;
  }
}
