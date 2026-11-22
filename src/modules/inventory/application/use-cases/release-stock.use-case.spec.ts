import { describe, it, expect } from 'vitest';
import { SequentialIdGenerator } from '#test/fakes/sequential-id-generator';
import { FakeTransactionManager } from '#test/fakes/fake-transaction-manager';
import { InMemoryStockRepository } from '../../infra/database/in-memory/in-memory-stock.repository.js';
import { ReleaseStockUseCase } from './release-stock.use-case.js';
import { ReserveStockUseCase } from './reserve-stock.use-case.js';

describe('ReleaseStockUseCase', () => {
  const setup = () => {
    const stock = new InMemoryStockRepository({ p1: 10, p2: 5 });
    const tx = new FakeTransactionManager();
    return {
      stock,
      reserve: new ReserveStockUseCase(stock, new SequentialIdGenerator(), tx),
      release: new ReleaseStockUseCase(stock, tx),
    };
  };
  const items = [
    { productId: 'p1', qty: 3 },
    { productId: 'p2', qty: 5 },
  ];

  it('repõe o estoque reservado', async () => {
    const { stock, reserve, release } = setup();
    await reserve.execute({ referenceId: 'o1', items });

    await release.execute({ referenceId: 'o1' });

    expect(stock.available('p1')).toBe(10);
    expect(stock.available('p2')).toBe(5);
  });

  it('liberar duas vezes repõe uma vez só', async () => {
    const { stock, reserve, release } = setup();
    await reserve.execute({ referenceId: 'o1', items });

    await release.execute({ referenceId: 'o1' });
    await release.execute({ referenceId: 'o1' });

    expect(stock.available('p1')).toBe(10);
  });

  it('sem reserva para a referência, não faz nada', async () => {
    const { stock, release } = setup();

    await release.execute({ referenceId: 'nunca-reservado' });

    expect(stock.available('p1')).toBe(10);
  });
});
