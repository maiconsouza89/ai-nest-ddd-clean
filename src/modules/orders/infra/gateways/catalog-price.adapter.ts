import { Money } from '#shared/domain/money.vo';
import { CatalogFacade } from '#modules/catalog/contracts/catalog.facade';
import { PriceCatalog } from '../../application/ports/price-catalog.js';

// Traduz o contrato do catalog (primitivos) para o port do orders (Money).
export class CatalogPriceAdapter implements PriceCatalog {
  constructor(private readonly catalog: CatalogFacade) {}

  async pricesOf(productIds: string[]) {
    const prices = await this.catalog.pricesOf(productIds);
    return new Map(prices.map((p) => [p.productId, Money.fromCents(p.priceCents, p.currency)]));
  }
}
