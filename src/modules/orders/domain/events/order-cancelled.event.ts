import { DomainEvent } from '../../../../shared/domain/domain-event';

export class OrderCancelled implements DomainEvent {
  readonly type = 'OrderCancelled';
  constructor(
    readonly orderId: string,
    readonly customerId: string,
  ) {}
}
