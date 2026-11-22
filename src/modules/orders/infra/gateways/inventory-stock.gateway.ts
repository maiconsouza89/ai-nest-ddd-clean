import { InventoryFacade } from '#modules/inventory/contracts/inventory.facade';
import { StockGateway } from '../../application/ports/stock-gateway.js';
import { InsufficientStockError } from '../../domain/errors/insufficient-stock.error.js';

// Traduz o contrato do inventory (resultado) para o port do orders (erro de domínio).
export class InventoryStockGateway implements StockGateway {
  constructor(private readonly inventory: InventoryFacade) {}

  async reserve(orderId: string, items: { productId: string; qty: number }[]) {
    const result = await this.inventory.reserve({ referenceId: orderId, items });
    if (!result.ok) throw new InsufficientStockError(result.productId);
  }
}
