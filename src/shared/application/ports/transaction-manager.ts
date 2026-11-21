export abstract class TransactionManager {
  /** Executa `work` numa transação. Se já houver uma ativa, reaproveita em vez de abrir outra. */
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
