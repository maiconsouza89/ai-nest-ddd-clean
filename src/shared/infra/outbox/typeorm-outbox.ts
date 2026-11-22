import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IntegrationEvent } from '../../application/integration-event.js';
import { Outbox } from '../../application/ports/outbox.js';
import { currentManager } from '../database/transaction-context.js';
import { currentTraceparent } from '../observability/trace-context.js';
import { OutboxMessageOrmEntity } from './outbox-message.orm-entity.js';

@Injectable()
export class TypeOrmOutbox implements Outbox {
  constructor(private readonly dataSource: DataSource) {}

  async add(aggregateId: string, events: IntegrationEvent[]) {
    if (events.length === 0) return;
    // todos os eventos da chamada nascem no mesmo contexto
    const traceparent = currentTraceparent();
    // usa a transação ativa, se houver
    await currentManager(this.dataSource).insert(
      OutboxMessageOrmEntity,
      events.map((e) => ({
        id: e.eventId,
        aggregateId,
        type: e.type,
        version: e.version,
        payload: e.payload,
        // o trace da requisição segue junto do evento
        metadata: { traceparent, ...e.metadata },
        occurredAt: new Date(e.occurredAt),
        // vence assim que ocorre, no mesmo relógio que o worker usa para decidir o que está vencido
        nextAttemptAt: new Date(e.occurredAt),
      })),
    );
  }
}
