import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProcessedEvents } from '../../application/ports/processed-events.js';
import { currentManager } from '../database/transaction-context.js';

@Injectable()
export class TypeOrmProcessedEvents implements ProcessedEvents {
  constructor(private readonly dataSource: DataSource) {}

  async tryMark(eventId: string, consumer: string) {
    // usa a transação ativa; sem RETURNING não dá para saber se inseriu
    const rows = await currentManager(this.dataSource).query<unknown[]>(
      `INSERT INTO shared.processed_events ("eventId", "consumer") VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING "eventId"`,
      [eventId, consumer],
    );
    return rows.length === 1;
  }
}
