import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'products', schema: 'catalog' })
export class ProductOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 120 })
  name!: string;

  // preço em centavos, inteiro
  @Column('int')
  priceCents!: number;

  @Column('varchar', { length: 3, default: 'BRL' })
  currency!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
