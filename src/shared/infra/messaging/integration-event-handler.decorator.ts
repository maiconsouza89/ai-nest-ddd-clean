import 'reflect-metadata';

export type EventSubscription = {
  /** Tipos de evento assinados, ex.: `orders.order-paid`. */
  events: string[];
  /** Nome estável do consumidor, o mesmo usado no `processed_events`. Dá nome à fila `events.<consumer>`. */
  consumer: string;
};

const SUBSCRIPTIONS = Symbol('integration-event-subscriptions');

/**
 * Assina o método a um evento de integração. Cada `consumer` tem a própria fila, com retry e falha próprios.
 * Um método atende um consumidor, que pode assinar vários tipos de evento.
 */
export function IntegrationEventHandler(subscription: EventSubscription): MethodDecorator {
  return (_target, _key, descriptor) => {
    Reflect.defineMetadata(SUBSCRIPTIONS, subscription, descriptor.value as object);
  };
}

export function subscriptionOf(handler: object): EventSubscription | undefined {
  return Reflect.getMetadata(SUBSCRIPTIONS, handler);
}
