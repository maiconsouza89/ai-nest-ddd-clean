import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
// import só de tipo + alvo por nome: evita o ciclo de imports em tempo de execução
import type { OrderOrmEntity } from './order.orm-entity';

@Entity({ name: 'order_items', schema: 'orders' })
export class OrderItemOrmEntity {
  // chave composta: o save() atualiza o item existente em vez de apagar e inserir
  @PrimaryColumn('uuid')
  orderId!: string;

  @PrimaryColumn('varchar')
  productId!: string;

  @Column('int')
  qty!: number;

  // bigint chega do driver como string; o mapper converte
  @Column('bigint')
  unitPriceCents!: string;

  @Column('varchar', { length: 3 })
  currency!: string;

  @ManyToOne('OrderOrmEntity', (order: OrderOrmEntity) => order.items, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'orderId' })
  order!: Relation<OrderOrmEntity>;
}
