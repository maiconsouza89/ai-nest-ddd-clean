import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { ReservationOrmEntity } from './reservation.orm-entity';

@Entity({ name: 'reservation_items', schema: 'inventory' })
export class ReservationItemOrmEntity {
  @PrimaryColumn('uuid')
  reservationId!: string;

  @PrimaryColumn('uuid')
  productId!: string;

  @Column('int')
  qty!: number;

  // alvo por nome: a reserva não precisa conhecer os itens
  @ManyToOne('ReservationOrmEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservationId' })
  reservation!: Relation<ReservationOrmEntity>;
}
