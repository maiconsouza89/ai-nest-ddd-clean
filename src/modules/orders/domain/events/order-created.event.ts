import { DomainEvent } from '#shared/domain/domain-event';

export class OrderCreated implements DomainEvent {
  readonly type = 'OrderCreated';
  constructor(
    readonly orderId: string,
    readonly customerId: string,
  ) {}
}
