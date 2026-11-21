import { Column, CreateDateColumn, Entity, Generated, Index, PrimaryColumn } from 'typeorm';

// só os pendentes: é o que o worker busca o tempo todo
@Index('IDX_shared_outbox_pending', ['nextAttemptAt'], {
  where: '"publishedAt" IS NULL AND "deadAt" IS NULL',
})
@Entity({ name: 'outbox', schema: 'shared' })
export class OutboxMessageOrmEntity {
  // o id do evento: a mesma identidade que os consumidores usam para idempotência
  @PrimaryColumn('uuid')
  id!: string;

  // ordem de inserção: define a sequência dos eventos de um mesmo agregado
  @Column('bigint')
  @Generated('increment')
  seq!: string;

  @Column('varchar')
  aggregateId!: string;

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

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column('int', { default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt!: Date;

  // fila de mensagens mortas: passou do limite de tentativas e não é mais buscado
  @Column({ type: 'timestamptz', nullable: true })
  deadAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;
}
