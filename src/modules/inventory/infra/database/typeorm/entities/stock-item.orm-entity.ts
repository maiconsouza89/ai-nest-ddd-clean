import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'stock_items', schema: 'inventory' })
@Check('CK_inventory_stock_items_available', '"available" >= 0') // rede de segurança do update condicional
export class StockItemOrmEntity {
  @PrimaryColumn('uuid')
  productId!: string;

  @Column('int', { default: 0 })
  available!: number;
}
