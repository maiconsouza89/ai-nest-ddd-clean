import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { startCatalogDatabase } from '../../../test/helpers/catalog-database';
import { ProductOrmEntity } from './product.orm-entity';
import { TypeOrmCatalogFacade } from './typeorm-catalog.facade';

describe('TypeOrmCatalogFacade (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let facade: TypeOrmCatalogFacade;

  beforeAll(async () => {
    ({ ds, stop } = await startCatalogDatabase());
    facade = new TypeOrmCatalogFacade(ds.getRepository(ProductOrmEntity));
  }, 120_000);

  afterAll(() => stop?.());

  const insert = (name: string, priceCents: number) => {
    const id = crypto.randomUUID();
    return ds.getRepository(ProductOrmEntity).insert({ id, name, priceCents }).then(() => id);
  };

  it('devolve preço e moeda dos produtos pedidos e ignora ids desconhecidos', async () => {
    const a = await insert('A', 1000);
    const b = await insert('B', 250);
    await insert('C', 999); // não pedido

    const prices = await facade.pricesOf([a, b, crypto.randomUUID()]);

    expect(prices).toHaveLength(2);
    expect(prices).toEqual(
      expect.arrayContaining([
        { productId: a, priceCents: 1000, currency: 'BRL' },
        { productId: b, priceCents: 250, currency: 'BRL' },
      ]),
    );
  });

  it('lista vazia não consulta nada e devolve vazio', async () => {
    expect(await facade.pricesOf([])).toEqual([]);
  });
});
