import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { currentManager } from '../../../../../shared/infra/database/transaction-context';
import { Order } from '../../../domain/entities/order.entity';
import { OrderRepository } from '../../../domain/repositories/order.repository';
import { OrderOrmEntity } from './entities/order.orm-entity';
import { OrderMapper } from './typeorm-order.mapper';

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  // usa a transação ativa, se houver
  private get repo() {
    return currentManager(this.dataSource).getRepository(OrderOrmEntity);
  }

  async save(order: Order) {
    await this.repo.save(OrderMapper.toPersistence(order));
  }

  async findById(id: string) {
    const raw = await this.repo.findOne({ where: { id }, relations: { items: true } });
    return raw ? OrderMapper.toDomain(raw) : null;
  }
}
