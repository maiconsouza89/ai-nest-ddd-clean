import { describe, it, expect, vi } from 'vitest';
import { FakeLogger } from '../../../../../test/fakes/fake-logger';
import { FakeOutbox } from '../../../../../test/fakes/fake-outbox';
import { FakeTransactionManager } from '../../../../../test/fakes/fake-transaction-manager';
import { FixedClock } from '../../../../../test/fakes/fixed-clock';
import { SequentialIdGenerator } from '../../../../../test/fakes/sequential-id-generator';
import { Money } from '../../../../shared/domain/money.vo';
import { Order } from '../../domain/entities/order.entity';
import { OrderStatus } from '../../domain/value-objects/order-status.vo';
import { InMemoryOrderRepository } from '../../infra/database/in-memory/in-memory-order.repository';
import { ExpirePendingOrdersUseCase } from './expire-pending-orders.use-case';

const HOUR = 3_600_000;
const NOW = new Date('2026-01-10T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * HOUR);

function setup(batchSize = 100) {
  // o repositório em memória carimba cada save com o "relógio" abaixo
  let savedAt = NOW;
  const repo = new InMemoryOrderRepository(() => savedAt);
  const outbox = new FakeOutbox();
  const logger = new FakeLogger();
  const useCase = new ExpirePendingOrdersUseCase(
    repo,
    outbox,
    new SequentialIdGenerator('evt'),
    new FixedClock(NOW),
    new FakeTransactionManager(),
    logger,
    { maxIdleMs: 24 * HOUR, batchSize },
  );

  async function seed(id: string, status: OrderStatus, idleHours: number) {
    const order = Order.create(id, 'u1');
    order.addItem('p1', 1, Money.fromCents(100));
    if (status !== OrderStatus.DRAFT) order.place();
    if (status === OrderStatus.PAID) order.pay();
    if (status === OrderStatus.CANCELLED) order.cancel();
    order.pullDomainEvents();
    savedAt = hoursAgo(idleHours);
    await repo.save(order);
  }

  return { repo, outbox, logger, useCase, seed };
}

describe('ExpirePendingOrdersUseCase', () => {
  it('cancela DRAFT e PLACED parados além do limite e publica OrderCancelled', async () => {
    const { repo, outbox, useCase, seed } = setup();
    await seed('draft', OrderStatus.DRAFT, 25);
    await seed('placed', OrderStatus.PLACED, 30);

    expect(await useCase.execute()).toBe(2);

    expect((await repo.findById('draft'))!.status).toBe(OrderStatus.CANCELLED);
    expect((await repo.findById('placed'))!.status).toBe(OrderStatus.CANCELLED);
    expect(outbox.events.map((e) => e.type)).toEqual([
      'orders.order-cancelled',
      'orders.order-cancelled',
    ]);
  });

  it('mantém pedidos recentes, pagos e já cancelados', async () => {
    const { repo, outbox, useCase, seed } = setup();
    await seed('recent', OrderStatus.PLACED, 23);
    await seed('paid', OrderStatus.PAID, 100);
    await seed('cancelled', OrderStatus.CANCELLED, 100);

    expect(await useCase.execute()).toBe(0);

    expect((await repo.findById('recent'))!.status).toBe(OrderStatus.PLACED);
    expect((await repo.findById('paid'))!.status).toBe(OrderStatus.PAID);
    expect(outbox.events).toHaveLength(0);
  });

  it('respeita o tamanho do lote, começando pelos mais antigos', async () => {
    const { repo, useCase, seed } = setup(1);
    await seed('newer', OrderStatus.DRAFT, 30);
    await seed('older', OrderStatus.DRAFT, 50);

    expect(await useCase.execute()).toBe(1);

    expect((await repo.findById('older'))!.status).toBe(OrderStatus.CANCELLED);
    expect((await repo.findById('newer'))!.status).toBe(OrderStatus.DRAFT);
  });

  it('pula, com aviso, o pedido que mudou de estado depois da listagem', async () => {
    const { repo, outbox, logger, useCase, seed } = setup();
    await seed('o1', OrderStatus.PLACED, 30);
    // simula o pagamento acontecendo entre a listagem e o cancelamento
    const find = repo.findById.bind(repo);
    vi.spyOn(repo, 'findById').mockImplementation(async (id) => {
      const order = await find(id);
      order?.pay();
      return order;
    });

    expect(await useCase.execute()).toBe(0);

    expect(outbox.events.filter((e) => e.type === 'orders.order-cancelled')).toHaveLength(0);
    expect(logger.entries.filter((e) => e.level === 'warn')).toHaveLength(1);
  });

  it('um pedido com erro inesperado não impede os seguintes', async () => {
    const { repo, logger, useCase, seed } = setup();
    await seed('bad', OrderStatus.PLACED, 50);
    await seed('good', OrderStatus.PLACED, 30);
    const save = repo.save.bind(repo);
    vi.spyOn(repo, 'save').mockImplementation(async (order) => {
      if (order.id === 'bad') throw new Error('banco fora');
      return save(order);
    });

    expect(await useCase.execute()).toBe(1);

    expect((await repo.findById('good'))!.status).toBe(OrderStatus.CANCELLED);
    expect(logger.entries.filter((e) => e.level === 'error')).toHaveLength(1);
  });
});
