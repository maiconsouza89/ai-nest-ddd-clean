import { describe, it, expect } from 'vitest';
import { Order } from '../../../domain/entities/order.entity';
import { InMemoryOrderRepository } from './in-memory-order.repository';

describe('InMemoryOrderRepository', () => {
  it('salva e busca um pedido pelo id', async () => {
    const repo = new InMemoryOrderRepository();
    const order = Order.create('o1', 'u1');
    await repo.save(order);
    expect(await repo.findById('o1')).toBe(order);
  });

  it('devolve null quando não existe', async () => {
    expect(await new InMemoryOrderRepository().findById('x')).toBeNull();
  });
});
