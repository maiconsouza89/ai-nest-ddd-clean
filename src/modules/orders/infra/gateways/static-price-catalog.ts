// PROVISÓRIO: catálogo fixo. Sai no passo 22, quando entra o módulo catalog.
import { Money } from '../../../../shared/domain/money.vo';
import { PriceCatalog } from '../../application/ports/price-catalog';

const PRICES: ReadonlyMap<string, Money> = new Map([
  ['p1', Money.fromCents(1000)],
  ['p2', Money.fromCents(2500)],
  ['p3', Money.fromCents(499)],
]);

export class StaticPriceCatalog implements PriceCatalog {
  async pricesOf(productIds: string[]) {
    const found = new Map<string, Money>();
    for (const id of productIds) {
      const price = PRICES.get(id);
      if (price) found.set(id, price);
    }
    return found;
  }
}
