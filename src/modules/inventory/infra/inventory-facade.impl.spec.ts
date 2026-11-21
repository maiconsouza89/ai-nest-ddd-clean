import { FakeTransactionManager } from '../../../../test/fakes/fake-transaction-manager';
import { SequentialIdGenerator } from '../../../../test/fakes/sequential-id-generator';
import { ReserveStockUseCase } from '../application/use-cases/reserve-stock.use-case';
import { InMemoryStockRepository } from './database/in-memory/in-memory-stock.repository';
import { InventoryFacadeImpl } from './inventory-facade.impl';

// Contrato da facade: o formato exato do resultado é o que o orders consome.
describe('InventoryFacade (contrato)', () => {
  const facade = () =>
    new InventoryFacadeImpl(
      new ReserveStockUseCase(
        new InMemoryStockRepository({ p1: 2 }),
        new SequentialIdGenerator(),
        new FakeTransactionManager(),
      ),
    );

  it('reserva possível devolve { ok: true }', async () => {
    expect(
      await facade().reserve({ referenceId: 'o1', items: [{ productId: 'p1', qty: 1 }] }),
    ).toEqual({
      ok: true,
    });
  });

  it('falta de estoque devolve { ok: false, reason, productId }, sem lançar', async () => {
    expect(
      await facade().reserve({ referenceId: 'o1', items: [{ productId: 'p1', qty: 3 }] }),
    ).toEqual({
      ok: false,
      reason: 'INSUFFICIENT_STOCK',
      productId: 'p1',
    });
  });
});
