import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OrderItemOrmEntity } from './order-item.orm-entity';

@Entity({ name: 'orders', schema: 'orders' })
export class OrderOrmEntity {
  // gerado pelo domínio, não pelo banco
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar')
  customerId!: string;

  @Column('varchar')
  status!: string;

  @OneToMany(() => OrderItemOrmEntity, (item) => item.order, { cascade: true })
  items!: Relation<OrderItemOrmEntity[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
