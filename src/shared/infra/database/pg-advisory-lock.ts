import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Exclusão mútua entre instâncias via advisory lock do Postgres. O lock é da sessão, então usa
 * uma conexão dedicada, fora da transação do `TransactionManager`. Se o processo cair, o
 * Postgres libera o lock junto com a conexão.
 */
@Injectable()
export class PgAdvisoryLock {
  constructor(private readonly dataSource: DataSource) {}

  /** Roda `fn` se conseguir o lock de `key`; devolve `false` (sem rodar) se outra instância o tem. */
  async runExclusive(key: string, fn: () => Promise<void>): Promise<boolean> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    // se o unlock falhar, a conexão ainda guarda o lock: precisa ser destruída, e não devolvida
    let discard: Error | undefined;
    try {
      const [{ locked }] = await runner.query(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked',
        [key],
      );
      if (!locked) return false;
      try {
        await fn();
      } finally {
        try {
          await runner.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]);
        } catch (unlockError) {
          // não esconde o erro de `fn`, que é o que importa para quem chamou
          discard = unlockError instanceof Error ? unlockError : new Error(String(unlockError));
        }
      }
      return true;
    } finally {
      // `release()` público não aceita erro. O método interno do driver aceita, e com erro o pool
      // fecha a conexão em vez de reaproveitá-la, o que faz o Postgres soltar o lock
      await (
        runner as unknown as { releasePostgresConnection(err?: Error): Promise<void> }
      ).releasePostgresConnection(discard);
    }
  }
}
