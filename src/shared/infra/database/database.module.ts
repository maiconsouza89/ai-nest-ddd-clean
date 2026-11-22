import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Logger } from '../../application/ports/logger.js';
import { Outbox } from '../../application/ports/outbox.js';
import { ProcessedEvents } from '../../application/ports/processed-events.js';
import { TransactionManager } from '../../application/ports/transaction-manager.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { OutboxMessageOrmEntity } from '../outbox/outbox-message.orm-entity.js';
import { ProcessedEventOrmEntity } from '../outbox/processed-event.orm-entity.js';
import { TypeOrmProcessedEvents } from '../outbox/typeorm-processed-events.js';
import { IdempotentConsumer } from '../../application/idempotent-consumer.js';
import { TypeOrmOutbox } from '../outbox/typeorm-outbox.js';
import { TypeOrmTransactionManager } from './typeorm-transaction-manager.js';

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
      useFactory: (tx: TransactionManager, processed: ProcessedEvents, logger: Logger) =>
        new IdempotentConsumer(tx, processed, logger),
      inject: [TransactionManager, ProcessedEvents, Logger],
    },
  ],
  exports: [TransactionManager, Outbox, IdempotentConsumer],
})
export class DatabaseModule {}
