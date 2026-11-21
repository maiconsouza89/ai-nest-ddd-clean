export abstract class StockGateway {
  /**
   * Reserva o estoque do pedido; repetir o mesmo `orderId` não reserva de novo.
   * Lança InsufficientStockError quando falta saldo.
   */
  abstract reserve(orderId: string, items: { productId: string; qty: number }[]): Promise<void>;
}
