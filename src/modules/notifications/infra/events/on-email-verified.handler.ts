import { Injectable } from '@nestjs/common';
import { IdempotentConsumer } from '#shared/application/idempotent-consumer';
import { IntegrationEventHandler } from '#shared/infra/messaging/integration-event-handler.decorator';
// só o tipo do contrato: o notifications não importa o identity para isso
import type { EmailVerifiedV1 } from '#modules/identity/contracts/events/email-verified.event';
import { SendWelcomeEmailUseCase } from '../../application/use-cases/send-welcome-email.use-case.js';

const CONSUMER = 'notifications.email-on-email-verified';

@Injectable()
export class OnEmailVerifiedHandler {
  constructor(
    private readonly consumer: IdempotentConsumer,
    private readonly sendEmail: SendWelcomeEmailUseCase,
  ) {}

  @IntegrationEventHandler({ events: ['identity.email-verified'], consumer: CONSUMER })
  handle(event: EmailVerifiedV1) {
    return this.consumer.handle(CONSUMER, event, ({ payload }) =>
      this.sendEmail.execute({ email: payload.email, name: payload.name }),
    );
  }
}
