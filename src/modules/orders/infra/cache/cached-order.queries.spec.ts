import { describe, it, expect } from 'vitest';
import { FakeCache } from '#test/fakes/fake-cache';
import { FakeLogger } from '#test/fakes/fake-logger';
import { Page, PageRequest } from '#shared/application/page';
import { OrderListItem, OrderQueries } from '../../application/queries/order.queries.js';
import { CachedOrderQueries } from './cached-order.queries.js';

const TTL = 60_000;

class CountingQueries implements OrderQueries {
  calls = 0;
  status = 'DRAFT';

  async listByCustomer(
    customerId: string,
    { page, limit }: PageRequest,
  ): Promise<Page<OrderListItem>> {
    this.calls++;
    return {
      items: [
        {
          id: `${customerId}-o1`,
          status: this.status,
          itemCount: 1,
          totalCents: 100,
          currency: 'BRL',
          createdAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ],
      total: 1,
      page,
      limit,
    };
  }
}

function setup() {
  const inner = new CountingQueries();
  const cache = new FakeCache();
  const logger = new FakeLogger();
  const queries = new CachedOrderQueries(inner, cache.asCache(), logger, TTL);
  return { inner, cache, logger, queries };
}

const first = { page: 1, limit: 20 };

describe('CachedOrderQueries', () => {
  it('a segunda listagem igual vem do cache, sem ir ao banco', async () => {
    const { inner, queries } = setup();

    await queries.listByCustomer('u1', first);
    await queries.listByCustomer('u1', first);

    expect(inner.calls).toBe(1);
  });

  it('devolve a data como Date também quando vem do cache', async () => {
    const { queries } = setup();

    await queries.listByCustomer('u1', first);
    const cached = await queries.listByCustomer('u1', first);

    expect(cached.items[0].createdAt).toEqual(new Date('2026-01-01T12:00:00.000Z'));
  });

  it('cada cliente e cada página têm a sua entrada', async () => {
    const { inner, queries } = setup();

    await queries.listByCustomer('u1', first);
    await queries.listByCustomer('u2', first);
    await queries.listByCustomer('u1', { page: 2, limit: 20 });
    await queries.listByCustomer('u1', { page: 1, limit: 10 });

    expect(inner.calls).toBe(4);
  });

  it('invalidar um cliente refaz a leitura dele e não mexe no cache dos outros', async () => {
    const { inner, queries } = setup();
    await queries.listByCustomer('u1', first);
    await queries.listByCustomer('u2', first);

    inner.status = 'PLACED';
    await queries.invalidate('u1');

    expect((await queries.listByCustomer('u1', first)).items[0].status).toBe('PLACED');
    expect((await queries.listByCustomer('u2', first)).items[0].status).toBe('DRAFT');
    expect(inner.calls).toBe(3);
  });

  it('invalidar duas vezes é inofensivo', async () => {
    const { inner, queries } = setup();
    await queries.invalidate('u1');
    await queries.invalidate('u1');

    await queries.listByCustomer('u1', first);
    await queries.listByCustomer('u1', first);

    expect(inner.calls).toBe(1);
  });

  it('toda chave tem TTL, e a geração vive mais que as páginas', async () => {
    const { cache, queries } = setup();
    await queries.invalidate('u1');
    await queries.listByCustomer('u1', first);

    const ttlOf = (prefix: string) =>
      [...cache.ttls].find(([key]) => key.startsWith(prefix))?.[1] as number;
    expect(ttlOf('orders:list:')).toBe(TTL);
    expect(ttlOf('orders:list-gen:')).toBeGreaterThan(TTL);
  });

  describe('com o Redis fora do ar', () => {
    it('a listagem continua respondendo, direto do banco, e registra o aviso', async () => {
      const { inner, cache, logger, queries } = setup();
      cache.failing = true;

      const page = await queries.listByCustomer('u1', first);

      expect(page.items).toHaveLength(1);
      expect(inner.calls).toBe(1);
      expect(logger.entries.some((e) => e.level === 'warn')).toBe(true);
    });

    it('invalidar não lança', async () => {
      const { cache, logger, queries } = setup();
      cache.failing = true;

      await expect(queries.invalidate('u1')).resolves.toBeUndefined();
      expect(logger.entries.some((e) => e.level === 'warn')).toBe(true);
    });

    it('não grava a página lida do banco sob uma geração desconhecida', async () => {
      const { cache, queries } = setup();
      cache.failing = true;
      await queries.listByCustomer('u1', first);
      cache.failing = false;

      expect(cache.store.size).toBe(0);
    });
  });
});
