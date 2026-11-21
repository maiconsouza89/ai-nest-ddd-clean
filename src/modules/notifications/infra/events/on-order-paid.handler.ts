import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IdempotentConsumer } from '../../../../shared/application/idempotent-consumer';
// só o tipo do contrato: o notifications nunca importa o módulo de orders
import type { OrderPaidV1 } from '../../../orders/contracts/events/order-paid.event';
import { SendOrderPaidEmailUseCase } from '../../application/use-cases/send-order-paid-email.use-case';

@Injectable()
export class OnOrderPaidHandler {
  constructor(
    private readonly consumer: IdempotentConsumer,
    private readonly sendEmail: SendOrderPaidEmailUseCase,
  ) {}

  // suppressErrors:false: sem isso o erro some e o worker marca o evento como entregue
  @OnEvent('orders.order-paid', { suppressErrors: false })
  handle(event: OrderPaidV1) {
    return this.consumer.handle('notifications.email-on-order-paid', event, (e) =>
      this.sendEmail.execute(e.payload),
    );
  }
}
