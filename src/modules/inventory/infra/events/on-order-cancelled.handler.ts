import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IdempotentConsumer } from '../../../../shared/application/idempotent-consumer';
// só o tipo do contrato: o inventory nunca importa o módulo de orders
import type { OrderCancelledV1 } from '../../../orders/contracts/events/order-cancelled.event';
import { ReleaseStockUseCase } from '../../application/use-cases/release-stock.use-case';

@Injectable()
export class OnOrderCancelledHandler {
  constructor(
    private readonly consumer: IdempotentConsumer,
    private readonly releaseStock: ReleaseStockUseCase,
  ) {}

  // suppressErrors:false: sem isso o erro some e o worker marca o evento como entregue
  @OnEvent('orders.order-cancelled', { suppressErrors: false })
  handle(event: OrderCancelledV1) {
    return this.consumer.handle('inventory.release-on-order-cancelled', event, (e) =>
      this.releaseStock.execute({ referenceId: e.payload.orderId }),
    );
  }
}
