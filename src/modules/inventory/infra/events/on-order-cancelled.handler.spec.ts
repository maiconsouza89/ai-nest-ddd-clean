import { describe, it, expect } from 'vitest';
import { FakeLogger } from '../../../../../test/fakes/fake-logger';
import { FakeProcessedEvents } from '../../../../../test/fakes/fake-processed-events';
import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { SequentialIdGenerator } from '../../../../../test/fakes/sequential-id-generator';
import { IdempotentConsumer } from '../../../../shared/application/idempotent-consumer';
import { orderCancelledV1Example } from '../../../orders/contracts/events/order-cancelled.v1.example';
import { ReleaseStockUseCase } from '../../application/use-cases/release-stock.use-case';
import { ReserveStockUseCase } from '../../application/use-cases/reserve-stock.use-case';
import { InMemoryStockRepository } from '../database/in-memory/in-memory-stock.repository';
import { OnOrderCancelledHandler } from './on-order-cancelled.handler';

// Lado de quem consome: o handler precisa entender o exemplo versionado do contrato do orders.
describe('OnOrderCancelledHandler', () => {
  const setup = async () => {
    const stock = new InMemoryStockRepository({ p1: 10 });
    const tx = new FakeTransactionManager();
    await new ReserveStockUseCase(stock, new SequentialIdGenerator(), tx).execute({
      referenceId: orderCancelledV1Example.payload.orderId,
      items: [{ productId: 'p1', qty: 4 }],
    });
    const handler = new OnOrderCancelledHandler(
      new IdempotentConsumer(tx, new FakeProcessedEvents(), new FakeLogger()),
      new ReleaseStockUseCase(stock, tx),
    );
    return { stock, handler };
  };

  it('libera o estoque do pedido que o exemplo do contrato descreve', async () => {
    const { stock, handler } = await setup();
    expect(stock.available('p1')).toBe(6);

    await handler.handle(orderCancelledV1Example);

    expect(stock.available('p1')).toBe(10);
  });

  it('o mesmo evento entregue duas vezes libera uma vez só', async () => {
    const { stock, handler } = await setup();

    await handler.handle(orderCancelledV1Example);
    await handler.handle(orderCancelledV1Example);

    expect(stock.available('p1')).toBe(10);
  });
});
