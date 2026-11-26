import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Clock } from '../../application/ports/clock.js';
import { EventPublisher } from '../../application/ports/event-publisher.js';
import { Logger } from '../../application/ports/logger.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { OutboxMetrics } from './outbox-metrics.js';
import { OutboxRelay } from './outbox-relay.js';
import { OutboxWorker } from './outbox-worker.js';

@Module({
  imports: [MessagingModule],
  providers: [
    {
      provide: OutboxRelay,
      useFactory: (ds: DataSource, publisher: EventPublisher, clock: Clock, logger: Logger) =>
        new OutboxRelay(ds, publisher, clock, logger),
      inject: [DataSource, EventPublisher, Clock, Logger],
    },
    OutboxWorker,
    OutboxMetrics,
  ],
})
export class OutboxModule {}
