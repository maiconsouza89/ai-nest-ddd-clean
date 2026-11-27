import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionManager } from '../../application/ports/transaction-manager.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { POSTGRES_ENV_KEYS, type PostgresEnv, postgresOptions } from './postgres-options.js';
import { TypeOrmTransactionManager } from './typeorm-transaction-manager.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<EnvironmentVariables, true>) => ({
        ...postgresOptions(
          Object.fromEntries(
            POSTGRES_ENV_KEYS.map((key) => [key, cfg.getOrThrow(key, { infer: true })]),
          ) as PostgresEnv,
        ),
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
