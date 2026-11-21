import { FakeProcessedEvents } from '../../../test/fakes/fake-processed-events';
import { FakeTransactionManager } from '../../../test/fakes/fake-transaction-manager';
import { IdempotentConsumer } from './idempotent-consumer';
import { IntegrationEvent } from './integration-event';

const event = (eventId: string): IntegrationEvent => ({
  eventId,
  type: 'orders.order-paid',
  version: 1,
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: {},
});

describe('IdempotentConsumer', () => {
  let tx: FakeTransactionManager;
  let consumer: IdempotentConsumer;
  let effects: string[];
  const work = async (e: IntegrationEvent) => {
    effects.push(e.eventId);
  };

  beforeEach(() => {
    tx = new FakeTransactionManager();
    consumer = new IdempotentConsumer(tx, new FakeProcessedEvents());
    effects = [];
  });

  it('produz o efeito uma vez só quando o mesmo evento chega duas vezes', async () => {
    await consumer.handle('inventory', event('e1'), work);
    await consumer.handle('inventory', event('e1'), work);

    expect(effects).toEqual(['e1']);
  });

  it('trata eventos diferentes e o mesmo evento em consumidores diferentes', async () => {
    await consumer.handle('inventory', event('e1'), work);
    await consumer.handle('inventory', event('e2'), work);
    await consumer.handle('billing', event('e1'), work);

    expect(effects).toEqual(['e1', 'e2', 'e1']);
  });

  it('roda dentro de uma transação', async () => {
    await consumer.handle('inventory', event('e1'), work);

    expect(tx.runs).toBe(1);
  });
});
