import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionManager } from '../../application/ports/transaction-manager';
import { EnvironmentVariables } from '../config/env.validation';
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
  ],
  providers: [{ provide: TransactionManager, useClass: TypeOrmTransactionManager }],
  exports: [TransactionManager],
})
export class DatabaseModule {}
