// API pública do inventory: só tipos primitivos.
export type ReserveStockCommand = {
  /** Identifica a reserva (ex.: id do pedido). Repetir a mesma referência não reserva de novo. */
  referenceId: string;
  items: { productId: string; qty: number }[];
};

export type ReserveStockResult =
  { ok: true } | { ok: false; reason: 'INSUFFICIENT_STOCK'; productId: string };

export abstract class InventoryFacade {
  /**
   * Se devolver `ok: false`, quem chamou deve desfazer a transação em andamento:
   * baixas feitas antes da falta não são revertidas aqui.
   */
  abstract reserve(cmd: ReserveStockCommand): Promise<ReserveStockResult>;
}
