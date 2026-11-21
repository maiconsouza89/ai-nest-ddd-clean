import { describe, it, expect } from 'vitest';
import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { SequentialIdGenerator } from '../../../../../test/fakes/sequential-id-generator';
import { InsufficientStockError } from '../../domain/errors/insufficient-stock.error';
import { InMemoryStockRepository } from '../../infra/database/in-memory/in-memory-stock.repository';
import { ReserveStockUseCase } from './reserve-stock.use-case';

function setup() {
  const stock = new InMemoryStockRepository({ a: 5, b: 1 });
  const tx = new FakeTransactionManager();
  return {
    stock,
    tx,
    useCase: new ReserveStockUseCase(stock, new SequentialIdGenerator('res'), tx),
  };
}

describe('ReserveStockUseCase', () => {
  it('debita o estoque de cada item', async () => {
    const { stock, useCase } = setup();
    await useCase.execute({
      referenceId: 'o1',
      items: [
        { productId: 'a', qty: 2 },
        { productId: 'b', qty: 1 },
      ],
    });
    expect(stock.available('a')).toBe(3);
    expect(stock.available('b')).toBe(0);
  });

  it('repetir a mesma referência não debita de novo', async () => {
    const { stock, useCase } = setup();
    const input = { referenceId: 'o1', items: [{ productId: 'a', qty: 2 }] };
    await useCase.execute(input);
    await useCase.execute(input);
    expect(stock.available('a')).toBe(3);
  });

  it('lança InsufficientStockError quando falta saldo', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ referenceId: 'o1', items: [{ productId: 'b', qty: 2 }] }),
    ).rejects.toThrow(InsufficientStockError);
  });

  it('produto sem registro de estoque conta como sem saldo', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ referenceId: 'o1', items: [{ productId: 'zzz', qty: 1 }] }),
    ).rejects.toThrow(InsufficientStockError);
  });

  it('roda dentro de uma transação', async () => {
    const { tx, useCase } = setup();
    await useCase.execute({ referenceId: 'o1', items: [{ productId: 'a', qty: 1 }] });
    expect(tx.runs).toBe(1);
  });
});
