export type StockLine = { productId: string; qty: number };

export abstract class StockRepository {
  /** Registra a reserva. Devolve false se já existia uma para essa referência. */
  abstract registerReservation(
    id: string,
    referenceId: string,
    items: StockLine[],
  ): Promise<boolean>;

  /**
   * Marca a reserva como liberada e devolve os itens a repor.
   * Devolve null se não há reserva para a referência ou se ela já foi liberada.
   */
  abstract releaseReservation(referenceId: string): Promise<StockLine[] | null>;

  /** Repõe o saldo. */
  abstract increase(productId: string, qty: number): Promise<void>;

  /** Baixa atômica e condicional. Devolve false se o saldo não cobre `qty`. */
  abstract decrease(productId: string, qty: number): Promise<boolean>;
}
