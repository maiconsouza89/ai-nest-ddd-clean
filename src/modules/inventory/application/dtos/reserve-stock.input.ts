import { StockLine } from '../../domain/repositories/stock.repository.js';

export type ReserveStockInput = {
  referenceId: string;
  items: StockLine[];
};
