import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { currentManager } from '../../../../../shared/infra/database/transaction-context';
import { StockLine, StockRepository } from '../../../domain/repositories/stock.repository';
import { ReservationItemOrmEntity } from './entities/reservation-item.orm-entity';
import { ReservationOrmEntity } from './entities/reservation.orm-entity';
import { StockItemOrmEntity } from './entities/stock-item.orm-entity';

@Injectable()
export class TypeOrmStockRepository implements StockRepository {
  constructor(private readonly dataSource: DataSource) {}

  // usa a transação ativa, se houver
  private get manager() {
    return currentManager(this.dataSource);
  }

  async registerReservation(id: string, referenceId: string, items: StockLine[]) {
    const manager = this.manager;
    const res = await manager
      .createQueryBuilder()
      .insert()
      .into(ReservationOrmEntity)
      .values({ id, referenceId })
      .orIgnore() // ON CONFLICT DO NOTHING
      .returning('id')
      .execute();
    // sem linha devolvida, a referência já existia
    if ((res.raw as unknown[]).length === 0) return false;

    if (items.length > 0) {
      await manager.insert(
        ReservationItemOrmEntity,
        items.map((i) => ({ reservationId: id, productId: i.productId, qty: i.qty })),
      );
    }
    return true;
  }

  async releaseReservation(referenceId: string) {
    const manager = this.manager;
    // só a primeira liberação atualiza a linha
    const res = await manager
      .createQueryBuilder()
      .update(ReservationOrmEntity)
      .set({ releasedAt: () => 'now()' })
      .where('"referenceId" = :referenceId AND "releasedAt" IS NULL', { referenceId })
      .returning('id')
      .execute();
    const released = res.raw as { id: string }[];
    if (released.length === 0) return null;

    const items = await manager.find(ReservationItemOrmEntity, {
      where: { reservationId: released[0].id },
    });
    return items.map((i) => ({ productId: i.productId, qty: i.qty }));
  }

  async increase(productId: string, qty: number) {
    await this.manager
      .createQueryBuilder()
      .update(StockItemOrmEntity)
      .set({ available: () => '"available" + :qty' })
      .where('"productId" = :productId', { productId, qty })
      .execute();
  }

  async decrease(productId: string, qty: number) {
    const res = await this.manager
      .createQueryBuilder()
      .update(StockItemOrmEntity)
      .set({ available: () => '"available" - :qty' })
      .where('"productId" = :productId AND "available" >= :qty', { productId, qty })
      .execute();
    return res.affected === 1;
  }
}
