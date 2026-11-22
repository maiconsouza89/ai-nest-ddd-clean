import { Money } from '#shared/domain/money.vo';

export abstract class PriceCatalog {
  abstract pricesOf(productIds: string[]): Promise<Map<string, Money>>;
}
