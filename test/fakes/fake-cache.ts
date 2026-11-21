import type { Cache } from '@nestjs/cache-manager';

/**
 * Cache em memória com o pedaço da API do cache-manager que o código usa. TTL não é simulado.
 * `failing` faz as operações lançarem (defesa em profundidade); o store real em produção engole o erro,
 * e isso é coberto no teste de integração com o Redis parado.
 */
export class FakeCache {
  readonly store = new Map<string, unknown>();
  readonly ttls = new Map<string, number | undefined>();
  failing = false;

  async get<T>(key: string): Promise<T | undefined> {
    this.assertUp();
    // o Redis guarda JSON: a ida e volta reproduz o que acontece com datas e undefined
    return this.store.has(key) ? (JSON.parse(this.store.get(key) as string) as T) : undefined;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<T> {
    this.assertUp();
    this.store.set(key, JSON.stringify(value));
    this.ttls.set(key, ttl);
    return value;
  }

  asCache() {
    return this as unknown as Cache;
  }

  private assertUp() {
    if (this.failing) throw new Error('redis down');
  }
}
