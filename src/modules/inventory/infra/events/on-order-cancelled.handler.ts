import { Injectable } from '@nestjs/common';
import { IdempotentConsumer } from '../../../../shared/application/idempotent-consumer';
import { IntegrationEventHandler } from '../../../../shared/infra/messaging/integration-event-handler.decorator';
// só o tipo do contrato: o inventory nunca importa o módulo de orders
import type { OrderCancelledV1 } from '../../../orders/contracts/events/order-cancelled.event';
import { ReleaseStockUseCase } from '../../application/use-cases/release-stock.use-case';

@Injectable()
export class OnOrderCancelledHandler {
  constructor(
    private readonly consumer: IdempotentConsumer,
    private readonly releaseStock: ReleaseStockUseCase,
  ) {}

  @IntegrationEventHandler({ events: ['orders.order-cancelled'], consumer: 'inventory.release-on-order-cancelled' })
  handle(event: OrderCancelledV1) {
    return this.consumer.handle('inventory.release-on-order-cancelled', event, (e) =>
      this.releaseStock.execute({ referenceId: e.payload.orderId }),
    );
  }
}
