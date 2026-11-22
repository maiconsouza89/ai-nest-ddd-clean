import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionManager } from '../../application/ports/transaction-manager.js';
import { hasActiveTransaction, runWithManager } from './transaction-context.js';

@Injectable()
export class TypeOrmTransactionManager implements TransactionManager {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    if (hasActiveTransaction()) return work();
    return this.dataSource.transaction((em) => runWithManager(em, work));
  }
}
