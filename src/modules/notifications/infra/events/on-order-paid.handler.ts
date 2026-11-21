import { Injectable } from '@nestjs/common';
import { IdempotentConsumer } from '../../../../shared/application/idempotent-consumer';
import { IntegrationEventHandler } from '../../../../shared/infra/messaging/integration-event-handler.decorator';
// só o tipo do contrato: o notifications nunca importa o módulo de orders
import type { OrderPaidV1 } from '../../../orders/contracts/events/order-paid.event';
import { SendOrderPaidEmailUseCase } from '../../application/use-cases/send-order-paid-email.use-case';

@Injectable()
export class OnOrderPaidHandler {
  constructor(
    private readonly consumer: IdempotentConsumer,
    private readonly sendEmail: SendOrderPaidEmailUseCase,
  ) {}

  @IntegrationEventHandler({ events: ['orders.order-paid'], consumer: 'notifications.email-on-order-paid' })
  handle(event: OrderPaidV1) {
    return this.consumer.handle('notifications.email-on-order-paid', event, (e) =>
      this.sendEmail.execute(e.payload),
    );
  }
}
