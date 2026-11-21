import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// A chave composta é a constraint UNIQUE(eventId, consumer): cada consumidor trata cada evento uma vez.
@Entity({ name: 'processed_events', schema: 'shared' })
export class ProcessedEventOrmEntity {
  @PrimaryColumn('uuid')
  eventId!: string;

  @PrimaryColumn('varchar')
  consumer!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
