import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { startInventoryDatabase } from '#test/helpers/inventory-database';
import { UuidV7Generator } from '#shared/infra/runtime/uuid-v7.generator';
import { TypeOrmTransactionManager } from '#shared/infra/database/typeorm-transaction-manager';
import { ReleaseStockUseCase } from '../../../application/use-cases/release-stock.use-case.js';
import { ReserveStockUseCase } from '../../../application/use-cases/reserve-stock.use-case.js';
import { InsufficientStockError } from '../../../domain/errors/insufficient-stock.error.js';
import { TypeOrmStockRepository } from './typeorm-stock.repository.js';

describe('ReserveStockUseCase com Postgres (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let useCase: ReserveStockUseCase;
  let release: ReleaseStockUseCase;

  beforeAll(async () => {
    ({ ds, stop } = await startInventoryDatabase());
    const tx = new TypeOrmTransactionManager(ds);
    release = new ReleaseStockUseCase(new TypeOrmStockRepository(ds), tx);
    useCase = new ReserveStockUseCase(
      new TypeOrmStockRepository(ds),
      new UuidV7Generator(),
      new TypeOrmTransactionManager(ds),
    );
  });

  afterAll(() => stop?.());

  const newId = () => crypto.randomUUID();
  const seed = (productId: string, available: number) =>
    ds.query(`INSERT INTO inventory.stock_items ("productId", available) VALUES ($1, $2)`, [
      productId,
      available,
    ]);
  const available = async (productId: string) =>
    (
      await ds.query(`SELECT available FROM inventory.stock_items WHERE "productId" = $1`, [
        productId,
      ])
    )[0].available as number;
  const reservations = async (referenceId: string) =>
    ds.query(`SELECT id FROM inventory.reservations WHERE "referenceId" = $1`, [referenceId]);

  it('debita o estoque e registra a reserva com seus itens', async () => {
    const a = newId();
    const b = newId();
    const ref = newId();
    await seed(a, 10);
    await seed(b, 5);

    await useCase.execute({
      referenceId: ref,
      items: [
        { productId: a, qty: 3 },
        { productId: b, qty: 5 },
      ],
    });

    expect(await available(a)).toBe(7);
    expect(await available(b)).toBe(0);
    const rows = await ds.query(
      `SELECT ri."productId" FROM inventory.reservation_items ri
       JOIN inventory.reservations r ON r.id = ri."reservationId" WHERE r."referenceId" = $1`,
      [ref],
    );
    expect(rows).toHaveLength(2);
  });

  it('repetir a mesma referência não debita de novo', async () => {
    const a = newId();
    const ref = newId();
    await seed(a, 10);
    const input = { referenceId: ref, items: [{ productId: a, qty: 4 }] };

    await useCase.execute(input);
    await useCase.execute(input);

    expect(await available(a)).toBe(6);
    expect(await reservations(ref)).toHaveLength(1);
  });

  it('falta num item desfaz tudo: reserva e baixas anteriores', async () => {
    const a = newId();
    const b = newId();
    const ref = newId();
    await seed(a, 10);
    await seed(b, 1);

    await expect(
      useCase.execute({
        referenceId: ref,
        items: [
          { productId: a, qty: 2 },
          { productId: b, qty: 2 },
        ],
      }),
    ).rejects.toThrow(InsufficientStockError);

    expect(await available(a)).toBe(10);
    expect(await available(b)).toBe(1);
    expect(await reservations(ref)).toEqual([]);
  });

  it('produto sem linha de estoque é falta', async () => {
    await expect(
      useCase.execute({ referenceId: newId(), items: [{ productId: newId(), qty: 1 }] }),
    ).rejects.toThrow(InsufficientStockError);
  });

  it('reservas concorrentes da última unidade: só uma vence e o saldo nunca fica negativo', async () => {
    const a = newId();
    await seed(a, 1);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        useCase.execute({ referenceId: newId(), items: [{ productId: a, qty: 1 }] }),
      ),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await available(a)).toBe(0);
  });

  describe('liberação', () => {
    it('devolve o estoque reservado e liberar de novo não repõe outra vez', async () => {
      const a = newId();
      const b = newId();
      const ref = newId();
      await seed(a, 10);
      await seed(b, 5);
      await useCase.execute({
        referenceId: ref,
        items: [
          { productId: a, qty: 3 },
          { productId: b, qty: 5 },
        ],
      });

      await release.execute({ referenceId: ref });
      await release.execute({ referenceId: ref });

      expect(await available(a)).toBe(10);
      expect(await available(b)).toBe(5);
    });

    it('liberações simultâneas repõem uma vez só', async () => {
      const a = newId();
      const ref = newId();
      await seed(a, 10);
      await useCase.execute({ referenceId: ref, items: [{ productId: a, qty: 4 }] });

      await Promise.all(Array.from({ length: 5 }, () => release.execute({ referenceId: ref })));

      expect(await available(a)).toBe(10);
    });

    it('referência sem reserva não faz nada', async () => {
      await release.execute({ referenceId: newId() });
    });
  });
});
