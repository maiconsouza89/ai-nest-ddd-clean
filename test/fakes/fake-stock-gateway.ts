import { StockGateway } from '#modules/orders/application/ports/stock-gateway';
import { InsufficientStockError } from '#modules/orders/domain/errors/insufficient-stock.error';

export class FakeStockGateway implements StockGateway {
  readonly reservations: { orderId: string; items: { productId: string; qty: number }[] }[] = [];

  constructor(private readonly outOfStock = false) {}

  async reserve(orderId: string, items: { productId: string; qty: number }[]) {
    if (this.outOfStock) throw new InsufficientStockError(items[0].productId);
    this.reservations.push({ orderId, items });
  }
}
