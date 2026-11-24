import { ReserveStockUseCase } from '../application/use-cases/reserve-stock.use-case.js';
import {
  InventoryFacade,
  ReserveStockCommand,
  ReserveStockResult,
} from '../contracts/inventory.facade.js';
import { InsufficientStockError } from '../domain/errors/insufficient-stock.error.js';

// Traduz o erro de domínio em resultado do contrato: o contrato não pode importar o domain.
export class InventoryFacadeImpl implements InventoryFacade {
  constructor(private readonly reserveStock: ReserveStockUseCase) {}

  async reserve(cmd: ReserveStockCommand): Promise<ReserveStockResult> {
    try {
      await this.reserveStock.execute(cmd);
      return { ok: true };
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        return { ok: false, reason: 'INSUFFICIENT_STOCK', productId: e.productId };
      }
      throw e;
    }
  }
}
