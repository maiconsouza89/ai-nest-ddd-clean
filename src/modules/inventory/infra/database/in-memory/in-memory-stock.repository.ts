import { StockLine, StockRepository } from '../../../domain/repositories/stock.repository';

export class InMemoryStockRepository implements StockRepository {
  private readonly levels = new Map<string, number>();
  private readonly references = new Set<string>();

  constructor(initial: Record<string, number> = {}) {
    for (const [productId, qty] of Object.entries(initial)) this.levels.set(productId, qty);
  }

  available(productId: string) {
    return this.levels.get(productId) ?? 0;
  }

  async registerReservation(_id: string, referenceId: string, _items: StockLine[]) {
    if (this.references.has(referenceId)) return false;
    this.references.add(referenceId);
    return true;
  }

  async decrease(productId: string, qty: number) {
    const current = this.available(productId);
    if (current < qty) return false;
    this.levels.set(productId, current - qty);
    return true;
  }
}
