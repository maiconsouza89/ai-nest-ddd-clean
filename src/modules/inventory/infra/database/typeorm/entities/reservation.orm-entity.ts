import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'reservations', schema: 'inventory' })
@Unique('UQ_inventory_reservations_reference', ['referenceId']) // garante a idempotência
export class ReservationOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  referenceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
