import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'reservations', schema: 'inventory' })
@Unique('UQ_inventory_reservations_reference', ['referenceId']) // garante a idempotência
export class ReservationOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  referenceId!: string;

  // preenchido quando o estoque volta (pedido cancelado); só libera uma vez
  @Column({ type: 'timestamptz', nullable: true })
  releasedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
