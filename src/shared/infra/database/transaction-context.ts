import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager } from 'typeorm';

// Guarda o EntityManager da transação ativa. Os repositórios o usam via currentManager(),
// assim o caso de uso não passa a transação adiante e nenhum repositório esquece o fallback.
const txStore = new AsyncLocalStorage<EntityManager>();

/** O manager da transação ativa; sem transação, o manager padrão do DataSource. */
export function currentManager(dataSource: DataSource): EntityManager {
  return txStore.getStore() ?? dataSource.manager;
}

export function hasActiveTransaction(): boolean {
  return txStore.getStore() !== undefined;
}

/** Só o TransactionManager deve chamar isto, ao abrir uma transação. */
export function runWithManager<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
  return txStore.run(manager, work);
}
