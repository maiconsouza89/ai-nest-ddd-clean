import { IdGenerator } from '#shared/application/ports/id-generator';
import { TransactionManager } from '#shared/application/ports/transaction-manager';
import { InsufficientStockError } from '../../domain/errors/insufficient-stock.error.js';
import { StockRepository } from '../../domain/repositories/stock.repository.js';
import { ReserveStockInput } from '../dtos/reserve-stock.input.js';

export class ReserveStockUseCase {
  constructor(
    private readonly stock: StockRepository,
    private readonly ids: IdGenerator,
    private readonly tx: TransactionManager,
  ) {}

  async execute({ referenceId, items }: ReserveStockInput) {
    await this.tx.run(async () => {
      // 1. idempotência: se a referência já foi reservada, não há nada a fazer
      const isNew = await this.stock.registerReservation(this.ids.next(), referenceId, items);
      if (!isNew) return;

      // 2. baixa atômica por item, em ordem fixa para evitar deadlock entre reservas concorrentes.
      // Qualquer falta lança e a transação desfaz a reserva e as baixas anteriores.
      const ordered = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
      for (const { productId, qty } of ordered) {
        if (!(await this.stock.decrease(productId, qty)))
          throw new InsufficientStockError(productId);
      }
    });
  }
}
