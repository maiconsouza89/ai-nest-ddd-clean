import { StockLine, StockRepository } from '../../../domain/repositories/stock.repository.js';

export class InMemoryStockRepository implements StockRepository {
  private readonly levels = new Map<string, number>();
  private readonly reservations = new Map<string, { items: StockLine[]; released: boolean }>();

  constructor(initial: Record<string, number> = {}) {
    for (const [productId, qty] of Object.entries(initial)) this.levels.set(productId, qty);
  }

  available(productId: string) {
    return this.levels.get(productId) ?? 0;
  }

  async registerReservation(_id: string, referenceId: string, items: StockLine[]) {
    if (this.reservations.has(referenceId)) return false;
    this.reservations.set(referenceId, { items, released: false });
    return true;
  }

  async releaseReservation(referenceId: string) {
    const reservation = this.reservations.get(referenceId);
    if (!reservation || reservation.released) return null;
    reservation.released = true;
    return reservation.items;
  }

  async increase(productId: string, qty: number) {
    this.levels.set(productId, this.available(productId) + qty);
  }

  async decrease(productId: string, qty: number) {
    const current = this.available(productId);
    if (current < qty) return false;
    this.levels.set(productId, current - qty);
    return true;
  }
}
