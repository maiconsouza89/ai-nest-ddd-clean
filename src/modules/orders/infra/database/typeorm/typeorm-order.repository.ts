import { Injectable } from '@nestjs/common';
import { DataSource, In, LessThan } from 'typeorm';
import { ConcurrencyError } from '#shared/domain/concurrency.error';
import { currentManager } from '#shared/infra/database/transaction-context';
import { Order } from '../../../domain/entities/order.entity.js';
import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { EXPIRABLE_STATUSES } from '../../../domain/value-objects/order-status.vo.js';
import { OrderOrmEntity } from './entities/order.orm-entity.js';
import { OrderMapper } from './typeorm-order.mapper.js';

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  // usa a transação ativa, se houver
  private get repo() {
    return currentManager(this.dataSource).getRepository(OrderOrmEntity);
  }

  async save(order: Order) {
    const next = order.version + 1;
    if (order.version > 0) {
      // só avança se ninguém gravou desde que o pedido foi carregado
      const res = await this.repo.update(
        { id: order.id, version: order.version },
        { version: next },
      );
      if (res.affected === 0) throw new ConcurrencyError();
    }
    await this.repo.save({ ...OrderMapper.toPersistence(order), version: next });
  }

  async findById(id: string) {
    const raw = await this.repo.findOne({ where: { id }, relations: { items: true } });
    return raw ? OrderMapper.toDomain(raw) : null;
  }

  async findByIdForUpdate(id: string) {
    // FOR UPDATE não vale sobre o lado opcional de um join: trava só a linha do pedido, sem itens
    const locked = await this.repo
      .createQueryBuilder('o')
      .select('o.id')
      .where('o.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    // carrega depois do lock: lê o estado confirmado mais recente
    return locked ? this.findById(id) : null;
  }

  async findStaleIds(cutoff: Date, limit: number) {
    const rows = await this.repo.find({
      select: { id: true },
      where: { status: In([...EXPIRABLE_STATUSES]), updatedAt: LessThan(cutoff) },
      order: { updatedAt: 'ASC' },
      take: limit,
    });
    return rows.map((r) => r.id);
  }
}
