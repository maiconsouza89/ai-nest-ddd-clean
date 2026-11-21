import { DomainEvent } from './domain-event';

/** A raiz registra os eventos; quem salva decide quando e onde publicá-los. */
export abstract class AggregateRoot {
  private events: DomainEvent[] = [];

  protected record(event: DomainEvent) {
    this.events.push(event);
  }

  /** Devolve os eventos registrados e esvazia a lista. */
  pullEvents() {
    const pulled = this.events;
    this.events = [];
    return pulled;
  }
}
