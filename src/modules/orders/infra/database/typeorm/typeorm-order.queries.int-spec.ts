import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { startOrdersDatabase } from '../../../../../../test/helpers/orders-database';
import { Money } from '../../../../../shared/domain/money.vo';
import { Order } from '../../../domain/entities/order.entity';
import { TypeOrmOrderQueries } from './typeorm-order.queries';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

describe('TypeOrmOrderQueries (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmOrderRepository;
  let queries: TypeOrmOrderQueries;

  beforeAll(async () => {
    ({ ds, stop } = await startOrdersDatabase());
    repo = new TypeOrmOrderRepository(ds);
    queries = new TypeOrmOrderQueries(ds);
  }, 120_000);

  afterAll(() => stop?.());

  async function seed(customerId: string, itemsOf: [string, number, number][]) {
    const order = Order.create(crypto.randomUUID(), customerId);
    for (const [productId, qty, cents] of itemsOf) {
      order.addItem(productId, qty, Money.fromCents(cents));
    }
    await repo.save(order);
    return order.id;
  }

  it('lista só os pedidos do cliente, com total e contagem de itens', async () => {
    const mine = await seed('owner', [
      ['p1', 2, 1000],
      ['p2', 1, 2500],
    ]);
    await seed('someone-else', [['p1', 1, 1000]]);

    const page = await queries.listByCustomer('owner', { page: 1, limit: 20 });

    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: mine,
      status: 'DRAFT',
      itemCount: 2,
      totalCents: 4500,
      currency: 'BRL',
    });
  });

  it('pedido sem itens aparece com total zero', async () => {
    await seed('empty-owner', []);
    const page = await queries.listByCustomer('empty-owner', { page: 1, limit: 20 });
    expect(page.items[0]).toMatchObject({ itemCount: 0, totalCents: 0 });
  });

  it('pagina, ordena do mais novo para o mais antigo e não repete itens', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await seed('paged', [['p1', 1, 100]]));
      await new Promise((r) => setTimeout(r, 5)); // createdAt distinto
    }

    const p1 = await queries.listByCustomer('paged', { page: 1, limit: 2 });
    const p2 = await queries.listByCustomer('paged', { page: 2, limit: 2 });
    const p3 = await queries.listByCustomer('paged', { page: 3, limit: 2 });

    expect(p1.total).toBe(5);
    expect([...p1.items, ...p2.items, ...p3.items].map((i) => i.id)).toEqual([...ids].reverse());
    expect(p3.items).toHaveLength(1);
  });

  it('cliente sem pedidos recebe página vazia', async () => {
    const page = await queries.listByCustomer('nobody', { page: 1, limit: 20 });
    expect(page).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });
});
