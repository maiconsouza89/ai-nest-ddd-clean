import { DomainEvent } from '#shared/domain/domain-event';

export class EmailVerified implements DomainEvent {
  readonly type = 'EmailVerified';
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly name: string,
  ) {}
}
