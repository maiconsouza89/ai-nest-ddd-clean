import { DomainEvent } from '#shared/domain/domain-event';

export class OrderPlaced implements DomainEvent {
  readonly type = 'OrderPlaced';
  constructor(
    readonly orderId: string,
    readonly customerId: string,
  ) {}
}
