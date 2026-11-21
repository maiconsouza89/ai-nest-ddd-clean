export type StockLine = { productId: string; qty: number };

export abstract class StockRepository {
  /** Registra a reserva. Devolve false se já existia uma para essa referência. */
  abstract registerReservation(id: string, referenceId: string, items: StockLine[]): Promise<boolean>;

  /** Baixa atômica e condicional. Devolve false se o saldo não cobre `qty`. */
  abstract decrease(productId: string, qty: number): Promise<boolean>;
}
