import { TransactionManager } from '../../src/shared/application/ports/transaction-manager';

// Só executa o trabalho e conta quantas vezes foi chamado.
export class FakeTransactionManager implements TransactionManager {
  runs = 0;

  run<T>(work: () => Promise<T>): Promise<T> {
    this.runs++;
    return work();
  }
}
