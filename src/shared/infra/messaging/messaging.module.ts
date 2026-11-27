import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EventPublisher } from '../../application/ports/event-publisher.js';
import { BullMqPublisher } from './bullmq-publisher.js';
import { EventSubscriptions } from './event-subscriptions.js';
import { EventWorkers } from './event-workers.js';
import { QueueMetrics } from './queue-metrics.js';

/** Transporte dos eventos de integração: uma fila BullMQ por consumidor. */
@Module({
  imports: [DiscoveryModule],
  providers: [
    EventSubscriptions,
    EventWorkers,
    QueueMetrics,
    BullMqPublisher,
    { provide: EventPublisher, useExisting: BullMqPublisher },
  ],
  exports: [EventPublisher],
})
export class MessagingModule {}
