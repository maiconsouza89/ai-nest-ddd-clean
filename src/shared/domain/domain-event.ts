/** Fato ocorrido no domínio. Os dados ficam nas classes concretas de cada módulo. */
export interface DomainEvent {
  readonly type: string;
}
