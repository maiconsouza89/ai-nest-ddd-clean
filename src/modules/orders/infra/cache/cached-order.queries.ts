import { randomUUID } from 'node:crypto';
import type { Cache } from '@nestjs/cache-manager';
import { Page, PageRequest } from '../../../../shared/application/page';
import { Logger } from '../../../../shared/application/ports/logger';
import { OrderListItem, OrderQueries } from '../../application/queries/order.queries';

// o JSON do Redis devolve a data como texto
type CachedPage = Omit<Page<OrderListItem>, 'items'> & {
  items: (Omit<OrderListItem, 'createdAt'> & { createdAt: string })[];
};

// A geração precisa viver mais que as páginas. Se expirasse antes, voltaria para a inicial e uma
// página antiga gravada nela poderia reaparecer.
const GENERATION_TTL_FACTOR = 2;

// geração usada quando o cliente ainda não teve nenhuma invalidação (ou a geração expirou)
const INITIAL_GENERATION = '0';

/**
 * Decorator de leitura com cache (Redis) em volta de outro `OrderQueries`.
 *
 * Invalidar não apaga chaves, porque o Keyv não apaga por padrão. Cada cliente tem uma **geração**
 * (`orders:list-gen:<cliente>`), que faz parte da chave de cada página. Invalidar troca a geração:
 * as páginas antigas deixam de ser lidas e expiram pelo TTL.
 *
 * Falha do cache nunca derruba a leitura. Com o store de produção (`throwOnErrors: false`) o Redis fora
 * do ar vira miss no `get` e no-op no `set`, com o erro registrado pelo listener do store; os `catch`
 * abaixo cobrem o que ainda possa lançar. Uma invalidação perdida deixa páginas velhas por no máximo o TTL.
 */
export class CachedOrderQueries implements OrderQueries {
  constructor(
    private readonly inner: OrderQueries,
    private readonly cache: Cache,
    private readonly logger: Logger,
    private readonly ttlMs: number,
  ) {}

  async listByCustomer(customerId: string, request: PageRequest): Promise<Page<OrderListItem>> {
    const key = await this.pageKey(customerId, request);
    if (key) {
      const hit = await this.read(key);
      if (hit) return hit;
    }

    const fresh = await this.inner.listByCustomer(customerId, request);
    if (key) await this.write(key, fresh);
    return fresh;
  }

  /** Descarta as páginas em cache do cliente. Idempotente; falha do Redis só é registrada (o TTL cobre). */
  async invalidate(customerId: string) {
    try {
      await this.cache.set(this.generationKey(customerId), randomUUID(), this.ttlMs * GENERATION_TTL_FACTOR);
    } catch (err) {
      this.logger.warn({ err, customerId }, 'order list cache invalidation failed');
    }
  }

  private generationKey(customerId: string) {
    return `orders:list-gen:${customerId}`;
  }

  /** `null` quando a leitura da geração lança: sem ela não há chave segura, então não usa o cache. */
  private async pageKey(customerId: string, { page, limit }: PageRequest) {
    try {
      const generation =
        (await this.cache.get<string>(this.generationKey(customerId))) ?? INITIAL_GENERATION;
      return `orders:list:${customerId}:${generation}:${limit}:${page}`;
    } catch (err) {
      this.logger.warn({ err, customerId }, 'order list cache unavailable, reading from database');
      return null;
    }
  }

  private async read(key: string): Promise<Page<OrderListItem> | null> {
    try {
      const cached = await this.cache.get<CachedPage>(key);
      if (!cached) return null;
      return {
        ...cached,
        items: cached.items.map((item) => ({ ...item, createdAt: new Date(item.createdAt) })),
      };
    } catch (err) {
      this.logger.warn({ err, key }, 'order list cache read failed');
      return null;
    }
  }

  private async write(key: string, value: Page<OrderListItem>) {
    try {
      await this.cache.set(key, value, this.ttlMs);
    } catch (err) {
      this.logger.warn({ err, key }, 'order list cache write failed');
    }
  }
}
