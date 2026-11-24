import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, MoreThanOrEqual } from 'typeorm';
import { currentManager } from '#shared/infra/database/transaction-context';
import { VerificationCode } from '../../../domain/entities/verification-code.entity.js';
import { VerificationCodeRepository } from '../../../domain/repositories/verification-code.repository.js';
import { VerificationCodeOrmEntity } from './entities/verification-code.orm-entity.js';

@Injectable()
export class TypeOrmVerificationCodeRepository implements VerificationCodeRepository {
  constructor(private readonly dataSource: DataSource) {}

  // usa a transação ativa, se houver
  private get repo() {
    return currentManager(this.dataSource).getRepository(VerificationCodeOrmEntity);
  }

  async add(code: VerificationCode) {
    await this.repo.update({ userId: code.userId, usedAt: IsNull() }, { usedAt: code.createdAt });
    await this.repo.insert(code.toProps());
  }

  async findLatestForUpdate(userId: string) {
    // a relação `user` não é carregada, então a linha tem só as colunas das props
    const raw = await this.repo
      .createQueryBuilder('c')
      .where('c.userId = :userId', { userId })
      // o id (uuid v7) desempata dois códigos emitidos no mesmo milissegundo
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .limit(1)
      .setLock('pessimistic_write')
      .getOne();
    return raw ? VerificationCode.restore(raw) : null;
  }

  countIssuedSince(userId: string, since: Date) {
    return this.repo.countBy({ userId, createdAt: MoreThanOrEqual(since) });
  }

  async save(code: VerificationCode) {
    const { id, attempts, usedAt } = code.toProps();
    await this.repo.update({ id }, { attempts, usedAt });
  }
}
