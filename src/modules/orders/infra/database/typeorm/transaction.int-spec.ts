import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { startOrdersDatabase } from '../../../../../../test/helpers/orders-database';
import { Money } from '../../../../../shared/domain/money.vo';
import { TypeOrmTransactionManager } from '../../../../../shared/infra/database/typeorm-transaction-manager';
import { Order } from '../../../domain/entities/order.entity';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

describe('TypeOrmTransactionManager (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmOrderRepository;
  let tx: TypeOrmTransactionManager;

  beforeAll(async () => {
    ({ ds, stop } = await startOrdersDatabase());
    repo = new TypeOrmOrderRepository(ds);
    tx = new TypeOrmTransactionManager(ds);
  }, 120_000);

  afterAll(() => stop?.());

  const newOrder = () => {
    const order = Order.create(crypto.randomUUID(), 'u1');
    order.addItem('p1', 1, Money.fromCents(100));
    return order;
  };

  it('confirma tudo quando o trabalho termina sem erro', async () => {
    const a = newOrder();
    const b = newOrder();

    const result = await tx.run(async () => {
      await repo.save(a);
      await repo.save(b);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(await repo.findById(a.id)).not.toBeNull();
    expect(await repo.findById(b.id)).not.toBeNull();
  });

  it('um erro no meio do tx.run não deixa nada gravado', async () => {
    const a = newOrder();
    const b = newOrder();

    await expect(
      tx.run(async () => {
        await repo.save(a);
        await repo.save(b);
        throw new Error('falha no meio');
      }),
    ).rejects.toThrow('falha no meio');

    expect(await repo.findById(a.id)).toBeNull();
    expect(await repo.findById(b.id)).toBeNull();
    expect(await ds.query('SELECT 1 FROM orders.order_items WHERE "orderId" = $1', [a.id])).toEqual(
      [],
    );
  });

  it('um tx.run aninhado reaproveita a transação: desfazer a externa desfaz a interna', async () => {
    const outer = newOrder();
    const inner = newOrder();

    await expect(
      tx.run(async () => {
        await repo.save(outer);
        await tx.run(() => repo.save(inner));
        throw new Error('falha depois do aninhado');
      }),
    ).rejects.toThrow('falha depois do aninhado');

    expect(await repo.findById(outer.id)).toBeNull();
    expect(await repo.findById(inner.id)).toBeNull();
  });

  it('transações simultâneas não vazam o contexto uma para a outra', async () => {
    const ok = newOrder();
    const failing = newOrder();

    const results = await Promise.allSettled([
      tx.run(async () => {
        await repo.save(failing);
        await new Promise((r) => setTimeout(r, 20));
        throw new Error('só esta falha');
      }),
      tx.run(async () => {
        await new Promise((r) => setTimeout(r, 5));
        await repo.save(ok);
      }),
    ]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect(await repo.findById(ok.id)).not.toBeNull();
    expect(await repo.findById(failing.id)).toBeNull();
  });

  it('fora de um tx.run, o repositório grava direto', async () => {
    const order = newOrder();
    await repo.save(order);
    expect(await repo.findById(order.id)).not.toBeNull();
  });
});
