import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IdempotentConsumer } from '../../application/idempotent-consumer.js';
import { Clock } from '../../application/ports/clock.js';
import { EventPublisher } from '../../application/ports/event-publisher.js';
import { Logger } from '../../application/ports/logger.js';
import { Outbox } from '../../application/ports/outbox.js';
import { ProcessedEvents } from '../../application/ports/processed-events.js';
import { TransactionManager } from '../../application/ports/transaction-manager.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { OutboxMessageOrmEntity } from './outbox-message.orm-entity.js';
import { OutboxMetrics } from './outbox-metrics.js';
import { OutboxRelay } from './outbox-relay.js';
import { OutboxWorker } from './outbox-worker.js';
import { ProcessedEventOrmEntity } from './processed-event.orm-entity.js';
import { TypeOrmOutbox } from './typeorm-outbox.js';
import { TypeOrmProcessedEvents } from './typeorm-processed-events.js';

// liga a outbox (quem grava) e a inbox (quem consome uma vez só); o transporte vem do MessagingModule
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxMessageOrmEntity, ProcessedEventOrmEntity]),
    MessagingModule,
  ],
  providers: [
    { provide: Outbox, useClass: TypeOrmOutbox },
    { provide: ProcessedEvents, useClass: TypeOrmProcessedEvents },
    {
      provide: IdempotentConsumer,
      useFactory: (tx: TransactionManager, processed: ProcessedEvents, logger: Logger) =>
        new IdempotentConsumer(tx, processed, logger),
      inject: [TransactionManager, ProcessedEvents, Logger],
    },
    {
      provide: OutboxRelay,
      useFactory: (ds: DataSource, publisher: EventPublisher, clock: Clock, logger: Logger) =>
        new OutboxRelay(ds, publisher, clock, logger),
      inject: [DataSource, EventPublisher, Clock, Logger],
    },
    OutboxWorker,
    OutboxMetrics,
  ],
  exports: [Outbox, IdempotentConsumer],
})
export class OutboxModule {}
