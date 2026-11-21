import { DomainEvent } from './domain-event';

/**
 * Base dos agregados que avisam o resto do sistema do que aconteceu.
 *
 * 1. O método de negócio (ex.: `pay()`) muda o estado e chama `addDomainEvent`.
 *    Isso só anota o fato numa lista em memória; nada é publicado.
 * 2. O caso de uso salva o agregado e chama `pullDomainEvents()`.
 * 3. O caso de uso grava esses eventos na outbox, na mesma transação do `save`.
 *
 * Assim o evento só sai se o `save` confirmar, e a entidade nunca conhece o barramento.
 */
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];

  /** Anota um fato ocorrido neste agregado, para o caso de uso publicar depois do `save`. */
  protected addDomainEvent(event: DomainEvent) {
    this.domainEvents.push(event);
  }

  /** Entrega os eventos anotados e esvazia a lista, para não serem publicados duas vezes. */
  pullDomainEvents() {
    const pulled = this.domainEvents;
    this.domainEvents = [];
    return pulled;
  }
}
