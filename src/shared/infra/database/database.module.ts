import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outbox } from '../../application/ports/outbox';
import { ProcessedEvents } from '../../application/ports/processed-events';
import { TransactionManager } from '../../application/ports/transaction-manager';
import { EnvironmentVariables } from '../config/env.validation';
import { OutboxMessageOrmEntity } from '../outbox/outbox-message.orm-entity';
import { ProcessedEventOrmEntity } from '../outbox/processed-event.orm-entity';
import { TypeOrmProcessedEvents } from '../outbox/typeorm-processed-events';
import { IdempotentConsumer } from '../../application/idempotent-consumer';
import { TypeOrmOutbox } from '../outbox/typeorm-outbox';
import { TypeOrmTransactionManager } from './typeorm-transaction-manager';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres',
        url: cfg.getOrThrow('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    TypeOrmModule.forFeature([OutboxMessageOrmEntity, ProcessedEventOrmEntity]),
  ],
  providers: [
    { provide: TransactionManager, useClass: TypeOrmTransactionManager },
    { provide: Outbox, useClass: TypeOrmOutbox },
    { provide: ProcessedEvents, useClass: TypeOrmProcessedEvents },
    {
      provide: IdempotentConsumer,
      useFactory: (tx: TransactionManager, processed: ProcessedEvents) =>
        new IdempotentConsumer(tx, processed),
      inject: [TransactionManager, ProcessedEvents],
    },
  ],
  exports: [TransactionManager, Outbox, IdempotentConsumer],
})
export class DatabaseModule {}
