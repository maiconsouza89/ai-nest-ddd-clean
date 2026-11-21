import { FakeOutbox } from '../../../../../test/fakes/fake-outbox';
import { FakePriceCatalog } from '../../../../../test/fakes/fake-price-catalog';
import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { FixedClock } from '../../../../../test/fakes/fixed-clock';
import { SequentialIdGenerator } from '../../../../../test/fakes/sequential-id-generator';
import { Money } from '../../../../shared/domain/money.vo';
import { ProductNotFoundError } from '../../domain/errors/product-not-found.error';
import { InMemoryOrderRepository } from '../../infra/database/in-memory/in-memory-order.repository';
import { CreateOrderUseCase } from './create-order.use-case';

function setup() {
  const repo = new InMemoryOrderRepository();
  const catalog = new FakePriceCatalog(
    new Map([
      ['p1', Money.fromCents(100)],
      ['p2', Money.fromCents(250)],
    ]),
  );
  const tx = new FakeTransactionManager();
  const outbox = new FakeOutbox();
  const useCase = new CreateOrderUseCase(
    repo,
    catalog,
    outbox,
    new SequentialIdGenerator(),
    new FixedClock(),
    tx,
  );
  return { repo, tx, outbox, useCase };
}

describe('CreateOrderUseCase', () => {
  it('cria o pedido com preços do catálogo e salva', async () => {
    const { repo, useCase } = setup();
    const { id } = await useCase.execute({
      customerId: 'u1',
      items: [
        { productId: 'p1', qty: 2 },
        { productId: 'p2', qty: 1 },
      ],
    });

    expect(id).toBe('order-1');
    const saved = await repo.findById(id);
    expect(saved).not.toBeNull();
    expect(saved!.customerId).toBe('u1');
    expect(saved!.total.cents).toBe(450);
  });

  it('publica orders.order-created para o cliente, com o id do pedido', async () => {
    const { outbox, useCase } = setup();
    const { id } = await useCase.execute({ customerId: 'u1', items: [{ productId: 'p1', qty: 1 }] });

    expect(outbox.events).toHaveLength(1);
    expect(outbox.events[0]).toMatchObject({
      type: 'orders.order-created',
      payload: { orderId: id, customerId: 'u1' },
    });
    expect(outbox.aggregateIds).toEqual([id]);
  });

  it('não publica nada se o produto não existe', async () => {
    const { outbox, useCase } = setup();
    await expect(
      useCase.execute({ customerId: 'u1', items: [{ productId: 'nope', qty: 1 }] }),
    ).rejects.toThrow(ProductNotFoundError);
    expect(outbox.events).toEqual([]);
  });

  it('grava dentro de uma transação', async () => {
    const { tx, useCase } = setup();
    await useCase.execute({ customerId: 'u1', items: [{ productId: 'p1', qty: 1 }] });
    expect(tx.runs).toBe(1);
  });

  it('lança ProductNotFoundError para produto desconhecido e não salva', async () => {
    const { repo, useCase } = setup();
    await expect(
      useCase.execute({ customerId: 'u1', items: [{ productId: 'nope', qty: 1 }] }),
    ).rejects.toThrow(ProductNotFoundError);
    expect(await repo.findById('order-1')).toBeNull();
  });
});
