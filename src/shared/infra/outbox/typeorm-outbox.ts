import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IntegrationEvent } from '../../application/integration-event';
import { Outbox } from '../../application/ports/outbox';
import { currentManager } from '../database/transaction-context';
import { OutboxMessageOrmEntity } from './outbox-message.orm-entity';

@Injectable()
export class TypeOrmOutbox implements Outbox {
  constructor(private readonly dataSource: DataSource) {}

  async add(events: IntegrationEvent[]) {
    if (events.length === 0) return;
    // usa a transação ativa, se houver
    await currentManager(this.dataSource).insert(
      OutboxMessageOrmEntity,
      events.map((e) => ({
        id: e.eventId,
        type: e.type,
        version: e.version,
        payload: e.payload,
        occurredAt: new Date(e.occurredAt),
      })),
    );
  }
}
