import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { currentManager } from '#shared/infra/database/transaction-context';
import { User } from '../../../domain/entities/user.entity.js';
import { EmailAlreadyInUseError } from '../../../domain/errors/email-already-in-use.error.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { UserOrmEntity } from './entities/user.orm-entity.js';
import { UserMapper } from './typeorm-user.mapper.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  // usa a transação ativa, se houver
  private get repo() {
    return currentManager(this.dataSource).getRepository(UserOrmEntity);
  }

  async save(user: User) {
    try {
      await this.repo.save(UserMapper.toPersistence(user));
    } catch (e) {
      // duas requisições simultâneas passam pela checagem do caso de uso; o UNIQUE decide
      if (
        e instanceof QueryFailedError &&
        (e.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new EmailAlreadyInUseError();
      }
      throw e;
    }
  }

  async findByIdForUpdate(id: string) {
    const raw = await this.repo
      .createQueryBuilder('u')
      .where('u.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: Email) {
    const raw = await this.repo.findOneBy({ email: email.value });
    return raw ? UserMapper.toDomain(raw) : null;
  }
}
