import type { DataSource } from 'typeorm';
import { ProductOrmEntity } from '../../product.orm-entity.js';

// Ids fixos: o seed do inventory usa os mesmos (módulos só se conhecem por id).
export const SEED_PRODUCTS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Teclado mecânico', priceCents: 29900 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Mouse sem fio', priceCents: 14900 },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Monitor 27"', priceCents: 129900 },
];

export async function seedCatalog(ds: DataSource): Promise<void> {
  // insere só o que falta: rodar de novo não desfaz edições feitas depois
  await ds
    .getRepository(ProductOrmEntity)
    .createQueryBuilder()
    .insert()
    .values(SEED_PRODUCTS.map((p) => ({ ...p, currency: 'BRL' })))
    .orIgnore()
    .execute();
}
