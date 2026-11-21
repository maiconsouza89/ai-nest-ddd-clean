import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'outbox', schema: 'shared' })
export class OutboxMessageOrmEntity {
  // o id do evento: a mesma identidade que os consumidores usam para idempotência
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar')
  type!: string;

  @Column('int')
  version!: number;

  @Column('jsonb')
  payload!: object;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
