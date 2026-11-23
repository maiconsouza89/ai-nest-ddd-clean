import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CatalogModule } from '#modules/catalog/catalog.module';
import { IdentityAuthModule } from '#modules/identity/infra/identity-auth.module';
import { IdentityModule } from '#modules/identity/infra/identity.module';
import { InventoryModule } from '#modules/inventory/infra/inventory.module';
import { NotificationsModule } from '#modules/notifications/infra/notifications.module';
import { OrdersModule } from '#modules/orders/infra/orders.module';
import { AppCacheModule } from '#shared/infra/cache/cache.module';
import { ClockModule } from '#shared/infra/clock/clock.module';
import { AuthModule } from '#shared/infra/auth/auth.module';
import { JwtConfigModule } from '#shared/infra/auth/jwt-config.module';
import { EnvironmentVariables, validateEnv } from '#shared/infra/config/env.validation';
import { HealthModule } from '#shared/infra/health/health.module';
import { DatabaseModule } from '#shared/infra/database/database.module';
import { ObservabilityModule } from '#shared/infra/observability/observability.module';
import { Logger } from '#shared/application/ports/logger';
import { RedisThrottlerStorage } from '#shared/infra/http/redis-throttler-storage';
import { BullMqConnection } from '#shared/infra/messaging/bullmq-connection';
import { MessagingModule } from '#shared/infra/messaging/messaging.module';
import { OutboxModule } from '#shared/infra/outbox/outbox.module';

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
      imports: [MessagingModule],
      inject: [ConfigService, BullMqConnection, Logger],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        connection: BullMqConnection,
        logger: Logger,
      ) => ({
        throttlers: [{ ttl: seconds(60), limit: 100 }],
        // contadores no Redis: com N instâncias, o limite vale para a soma, e não para cada uma
        storage: new RedisThrottlerStorage(connection.producer, logger),
        skipIf: () => config.get('THROTTLE_ENABLED', { infer: true }) === 'false',
      }),
    }),
    ObservabilityModule,
    JwtConfigModule,
    AuthModule.forRoot({ imports: [IdentityAuthModule] }),
    ClockModule,
    DatabaseModule,
    AppCacheModule,
    HealthModule,
    OutboxModule,
    CatalogModule,
    IdentityModule,
    InventoryModule,
    OrdersModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
