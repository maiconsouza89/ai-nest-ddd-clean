import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { startOrdersDatabase } from '../../../../../../test/helpers/orders-database';
import { Money } from '../../../../../shared/domain/money.vo';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatus } from '../../../domain/value-objects/order-status.vo';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

describe('TypeOrmOrderRepository (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let repo: TypeOrmOrderRepository;

  beforeAll(async () => {
    ({ ds, stop } = await startOrdersDatabase());
    repo = new TypeOrmOrderRepository(ds);
  }, 120_000);

  afterAll(() => stop?.());

  const newId = () => crypto.randomUUID();

  const itemRows = (orderId: string) =>
    ds.query('SELECT "productId" FROM orders.order_items WHERE "orderId" = $1 ORDER BY "productId"', [
      orderId,
    ]);

  it('salva e busca um pedido com itens', async () => {
    const order = Order.create(newId(), 'u1');
    order.addItem('p1', 2, Money.fromCents(1000));
    order.addItem('p2', 1, Money.fromCents(2500));
    await repo.save(order);

    const found = await repo.findById(order.id);
    expect(found).not.toBeNull();
    expect(found!.customerId).toBe('u1');
    expect(found!.status).toBe(OrderStatus.DRAFT);
    expect(found!.items).toHaveLength(2);
    expect(found!.total.cents).toBe(4500);
  });

  it('converte o bigint para number ao ler', async () => {
    const order = Order.create(newId(), 'u1');
    order.addItem('p1', 1, Money.fromCents(123456789012));
    await repo.save(order);

    const [item] = (await repo.findById(order.id))!.items;
    expect(typeof item.unitPrice.cents).toBe('number');
    expect(item.unitPrice.cents).toBe(123456789012);
    expect(item.unitPrice.currency).toBe('BRL');
  });

  it('atualiza o pedido existente sem duplicar itens', async () => {
    const order = Order.create(newId(), 'u1');
    order.addItem('p1', 1, Money.fromCents(100));
    await repo.save(order);

    const loaded = (await repo.findById(order.id))!;
    loaded.addItem('p1', 2, Money.fromCents(100));
    loaded.place();
    await repo.save(loaded);

    const again = (await repo.findById(order.id))!;
    expect(again.status).toBe(OrderStatus.PLACED);
    expect(again.items).toHaveLength(1);
    expect(again.items[0].qty).toBe(3);
    expect(await itemRows(order.id)).toHaveLength(1);
  });

  it('remove a linha do item que saiu do array', async () => {
    const order = Order.create(newId(), 'u1');
    order.addItem('p1', 1, Money.fromCents(100));
    order.addItem('p2', 1, Money.fromCents(200));
    await repo.save(order);
    expect(await itemRows(order.id)).toHaveLength(2);

    // reconstrói o pedido sem o p2 e salva: a linha tem que sumir
    const loaded = (await repo.findById(order.id))!;
    const p1 = loaded.items.find((i) => i.productId === 'p1')!;
    await repo.save(Order.restore({ id: loaded.id, customerId: loaded.customerId, status: loaded.status, items: [p1] }));

    expect(await itemRows(order.id)).toEqual([{ productId: 'p1' }]);
  });

  it('devolve null para pedido inexistente', async () => {
    expect(await repo.findById(newId())).toBeNull();
  });
});
