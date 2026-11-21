import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Clock } from '../../application/ports/clock';
import { EventPublisher } from '../../application/ports/event-publisher';
import { Logger } from '../../application/ports/logger';
import { MessagingModule } from '../messaging/messaging.module';
import { OutboxRelay } from './outbox-relay';
import { OutboxWorker } from './outbox-worker';

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
  ],
})
export class OutboxModule {}
