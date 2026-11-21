import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'idempotency_keys', schema: 'orders' })
export class IdempotencyKeyOrmEntity {
  // a chave vale por usuário: duas pessoas podem usar o mesmo texto sem se enxergar
  @PrimaryColumn('varchar', { length: 255 })
  actorId!: string;

  @PrimaryColumn('varchar', { length: 255 })
  key!: string;

  @Column('varchar', { length: 255 })
  fingerprint!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
