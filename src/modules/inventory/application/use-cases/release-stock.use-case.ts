import { TransactionManager } from '../../../../shared/application/ports/transaction-manager';
import { StockRepository } from '../../domain/repositories/stock.repository';
import { ReleaseStockInput } from '../dtos/release-stock.input';

export class ReleaseStockUseCase {
  constructor(
    private readonly stock: StockRepository,
    private readonly tx: TransactionManager,
  ) {}

  async execute({ referenceId }: ReleaseStockInput) {
    await this.tx.run(async () => {
      // sem reserva (pedido cancelado antes de fechar) ou já liberada: nada a repor
      const items = await this.stock.releaseReservation(referenceId);
      if (!items) return;
      // mesma ordem fixa da reserva, para evitar deadlock
      const ordered = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
      for (const { productId, qty } of ordered) await this.stock.increase(productId, qty);
    });
  }
}
