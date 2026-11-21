import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/infra/identity.module';
import { InventoryModule } from './modules/inventory/infra/inventory.module';
import { OrdersModule } from './modules/orders/infra/orders.module';
import { ClockModule } from './shared/infra/clock/clock.module';
import { AuthModule } from './shared/infra/auth/auth.module';
import { EnvironmentVariables, validateEnv } from './shared/infra/config/env.validation';
import { HealthModule } from './shared/infra/health/health.module';
import { DatabaseModule } from './shared/infra/database/database.module';
import { ObservabilityModule } from './shared/infra/observability/observability.module';
import { OutboxModule } from './shared/infra/outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [{ ttl: seconds(60), limit: 100 }],
        skipIf: () => config.get('THROTTLE_ENABLED', { infer: true }) === 'false',
      }),
    }),
    ScheduleModule.forRoot(),
    ObservabilityModule,
    AuthModule,
    ClockModule,
    DatabaseModule,
    HealthModule,
    OutboxModule,
    CatalogModule,
    IdentityModule,
    InventoryModule,
    OrdersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
