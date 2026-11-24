import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Page, PageRequest } from '#shared/application/page';
import {
  OrderDetails,
  OrderListItem,
  OrderQueries,
} from '../../../application/queries/order.queries.js';
import { OrderOrmEntity } from './entities/order.orm-entity.js';

type Row = Omit<OrderListItem, 'itemCount' | 'totalCents'> & {
  itemCount: string;
  totalCents: string;
};

@Injectable()
export class TypeOrmOrderQueries implements OrderQueries {
  constructor(private readonly dataSource: DataSource) {}

  async listByCustomer(
    customerId: string,
    { page, limit }: PageRequest,
  ): Promise<Page<OrderListItem>> {
    const orders = this.dataSource.getRepository(OrderOrmEntity);

    // o filtro de dono fica na query, nunca depois de carregar
    const [total, rows] = await Promise.all([
      orders.countBy({ customerId }),
      orders
        .createQueryBuilder('o')
        .leftJoin('o.items', 'i')
        .where('o.customerId = :customerId', { customerId })
        .select('o.id', 'id')
        .addSelect('o.status', 'status')
        .addSelect('o.createdAt', 'createdAt')
        .addSelect('COUNT(i.productId)', 'itemCount')
        .addSelect('COALESCE(SUM(i.qty * i.unitPriceCents), 0)', 'totalCents')
        .addSelect("COALESCE(MIN(i.currency), 'BRL')", 'currency')
        .groupBy('o.id')
        .orderBy('o.createdAt', 'DESC')
        .addOrderBy('o.id', 'DESC') // desempate estável
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<Row>(),
    ]);

    return {
      items: rows.map((r) => ({
        ...r,
        // count e sum chegam do driver como string
        itemCount: Number(r.itemCount),
        totalCents: Number(r.totalCents),
      })),
      total,
      page,
      limit,
    };
  }

  async getById(orderId: string): Promise<OrderDetails | null> {
    // query builder sem take: uma consulta só, com o join dos itens
    const order = await this.dataSource
      .getRepository(OrderOrmEntity)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'i')
      .where('o.id = :orderId', { orderId })
      .orderBy('i.productId')
      .getOne();
    if (!order) return null;

    const items = order.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitPriceCents: Number(i.unitPriceCents), // bigint chega do driver como string
      currency: i.currency,
    }));
    return {
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      items,
      totalCents: items.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0),
      // como na listagem: a moeda dos itens, ou BRL num pedido sem itens
      currency: items[0]?.currency ?? 'BRL',
    };
  }
}
