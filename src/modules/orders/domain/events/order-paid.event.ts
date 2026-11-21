import { DomainEvent } from '../../../../shared/domain/domain-event';

export class OrderPaid implements DomainEvent {
  readonly type = 'OrderPaid';
  constructor(readonly orderId: string) {}
}
