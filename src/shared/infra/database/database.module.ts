import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outbox } from '../../application/ports/outbox';
import { TransactionManager } from '../../application/ports/transaction-manager';
import { EnvironmentVariables } from '../config/env.validation';
import { OutboxMessageOrmEntity } from '../outbox/outbox-message.orm-entity';
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
    TypeOrmModule.forFeature([OutboxMessageOrmEntity]),
  ],
  providers: [
    { provide: TransactionManager, useClass: TypeOrmTransactionManager },
    { provide: Outbox, useClass: TypeOrmOutbox },
  ],
  exports: [TransactionManager, Outbox],
})
export class DatabaseModule {}
