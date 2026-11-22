import { PriceCatalog } from '#modules/orders/application/ports/price-catalog';
import { Money } from '#shared/domain/money.vo';

export class FakePriceCatalog implements PriceCatalog {
  constructor(private readonly prices: Map<string, Money>) {}

  async pricesOf(productIds: string[]) {
    const found = new Map<string, Money>();
    for (const id of productIds) {
      const price = this.prices.get(id);
      if (price) found.set(id, price);
    }
    return found;
  }
}
