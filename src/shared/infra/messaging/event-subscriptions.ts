import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { IntegrationEvent } from '../../application/integration-event';
import { subscriptionOf } from './integration-event-handler.decorator';

export type EventConsumer = {
  /** Nome do consumidor; a fila é `events.<name>`. */
  name: string;
  events: Set<string>;
  handle: (event: IntegrationEvent) => Promise<unknown>;
};

export const queueNameOf = (consumer: string) => `events.${consumer}`;

/** Varre os providers atrás de `@IntegrationEventHandler` e monta consumidor → eventos assinados. */
@Injectable()
export class EventSubscriptions implements OnApplicationBootstrap {
  private consumers?: Map<string, EventConsumer>;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
  ) {}

  /** Varre na subida: um consumidor declarado duas vezes derruba o app aqui, e o relay não paga a varredura. */
  onApplicationBootstrap() {
    this.all();
  }

  all(): EventConsumer[] {
    this.consumers ??= this.scan();
    return [...this.consumers.values()];
  }

  /** Consumidores assinantes do tipo. */
  forEvent(type: string): EventConsumer[] {
    return this.all().filter((c) => c.events.has(type));
  }

  private scan() {
    const consumers = new Map<string, EventConsumer>();
    for (const { instance } of this.discovery.getProviders()) {
      if (!instance || typeof instance !== 'object') continue;
      for (const method of this.scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
        const handler = (instance as Record<string, (e: IntegrationEvent) => Promise<unknown>>)[
          method
        ];
        const subscription = subscriptionOf(handler);
        if (!subscription) continue;
        const { events, consumer } = subscription;
        if (consumers.has(consumer)) {
          throw new Error(`Consumer "${consumer}" is declared by more than one handler method`);
        }
        consumers.set(consumer, {
          name: consumer,
          events: new Set(events),
          handle: (e) => handler.call(instance, e),
        });
      }
    }
    return consumers;
  }
}
