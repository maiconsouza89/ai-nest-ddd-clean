import { StockLine } from '../../domain/repositories/stock.repository';

export type ReserveStockInput = {
  referenceId: string;
  items: StockLine[];
};
