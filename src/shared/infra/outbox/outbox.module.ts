import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { Clock } from '../../application/ports/clock';
import { EventPublisher } from '../../application/ports/event-publisher';
import { Logger } from '../../application/ports/logger';
import { EventEmitterPublisher } from './event-emitter-publisher';
import { OutboxRelay } from './outbox-relay';
import { OutboxWorker } from './outbox-worker';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    { provide: EventPublisher, useClass: EventEmitterPublisher },
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
