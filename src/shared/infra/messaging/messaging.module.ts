import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EventPublisher } from '../../application/ports/event-publisher';
import { BullMqConnection } from './bullmq-connection';
import { BullMqPublisher } from './bullmq-publisher';
import { EventSubscriptions } from './event-subscriptions';
import { EventWorkers } from './event-workers';

/** Transporte dos eventos de integração: uma fila BullMQ por consumidor. */
@Module({
  imports: [DiscoveryModule],
  providers: [
    BullMqConnection,
    EventSubscriptions,
    EventWorkers,
    BullMqPublisher,
    { provide: EventPublisher, useExisting: BullMqPublisher },
  ],
  exports: [EventPublisher, BullMqConnection],
})
export class MessagingModule {}
