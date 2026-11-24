import { Injectable } from '@nestjs/common';
import { IdempotentConsumer } from '#shared/application/idempotent-consumer';
import { IntegrationEventHandler } from '#shared/infra/messaging/integration-event-handler.decorator';
// só o tipo do contrato: o notifications não importa o identity para isso
import type { VerificationCodeIssuedV1 } from '#modules/identity/contracts/events/verification-code-issued.event';
import { SendVerificationCodeEmailUseCase } from '../../application/use-cases/send-verification-code-email.use-case.js';

const CONSUMER = 'notifications.email-on-verification-code-issued';

@Injectable()
export class OnVerificationCodeIssuedHandler {
  constructor(
    private readonly consumer: IdempotentConsumer,
    private readonly sendEmail: SendVerificationCodeEmailUseCase,
  ) {}

  @IntegrationEventHandler({ events: ['identity.verification-code-issued'], consumer: CONSUMER })
  handle(event: VerificationCodeIssuedV1) {
    return this.consumer.handle(CONSUMER, event, ({ payload, occurredAt }) =>
      this.sendEmail.execute({
        email: payload.email,
        name: payload.name,
        code: payload.code,
        issuedAt: occurredAt,
        expiresAt: payload.expiresAt,
      }),
    );
  }
}
