import type { DataSource } from 'typeorm';
import { StockItemOrmEntity } from '../entities/stock-item.orm-entity';

// Mesmos ids do seed do catalog (módulos só se conhecem por id).
export const SEED_STOCK = [
  { productId: '11111111-1111-4111-8111-111111111111', available: 50 },
  { productId: '22222222-2222-4222-8222-222222222222', available: 120 },
  { productId: '33333333-3333-4333-8333-333333333333', available: 10 },
];

export async function seedInventory(ds: DataSource): Promise<void> {
  // insere só o que falta: rodar de novo não restaura estoque já consumido
  await ds
    .getRepository(StockItemOrmEntity)
    .createQueryBuilder()
    .insert()
    .values(SEED_STOCK)
    .orIgnore()
    .execute();
}
