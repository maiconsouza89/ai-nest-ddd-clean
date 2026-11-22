import { DomainEvent } from '#shared/domain/domain-event';

export class OrderPaid implements DomainEvent {
  readonly type = 'OrderPaid';
  constructor(
    readonly orderId: string,
    readonly customerId: string,
    readonly totalCents: number,
    readonly currency: string,
  ) {}
}
