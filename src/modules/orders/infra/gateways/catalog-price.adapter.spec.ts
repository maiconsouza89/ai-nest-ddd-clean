import { CatalogFacade } from '../../../catalog/contracts/catalog.facade';
import { CatalogPriceAdapter } from './catalog-price.adapter';

describe('CatalogPriceAdapter', () => {
  it('converte centavos e moeda do catalog em Money, indexando por produto', async () => {
    const facade: CatalogFacade = {
      pricesOf: async () => [
        { productId: 'a', priceCents: 1000, currency: 'BRL' },
        { productId: 'b', priceCents: 250, currency: 'USD' },
      ],
    };

    const prices = await new CatalogPriceAdapter(facade).pricesOf(['a', 'b', 'x']);

    expect(prices.get('a')).toMatchObject({ cents: 1000, currency: 'BRL' });
    expect(prices.get('b')).toMatchObject({ cents: 250, currency: 'USD' });
    expect(prices.has('x')).toBe(false);
  });
});
