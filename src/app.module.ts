import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { CatalogModule } from '#modules/catalog/catalog.module';
import { IdentityAuthModule } from '#modules/identity/infra/identity-auth.module';
import { IdentityModule } from '#modules/identity/infra/identity.module';
import { InventoryModule } from '#modules/inventory/infra/inventory.module';
import { NotificationsModule } from '#modules/notifications/infra/notifications.module';
import { OrdersModule } from '#modules/orders/infra/orders.module';
import { AppCacheModule } from '#shared/infra/cache/cache.module';
import { RuntimeModule } from '#shared/infra/runtime/runtime.module';
import { AuthModule } from '#shared/infra/auth/auth.module';
import { JwtConfigModule } from '#shared/infra/auth/jwt-config.module';
import { EnvironmentVariables, validateEnv } from '#shared/infra/config/env.validation';
import { HealthModule } from '#shared/infra/health/health.module';
import { DatabaseModule } from '#shared/infra/database/database.module';
import { ObservabilityModule } from '#shared/infra/observability/observability.module';
import { Logger } from '#shared/application/ports/logger';
import { ENV_FILES, ignoresEnvFiles } from '#shared/infra/config/load-env-files';
import { ProblemDetailsModule } from '#shared/infra/http/problem-details.module';
import { RedisThrottlerStorage } from '#shared/infra/http/redis-throttler-storage';
import { accountThrottlers } from '#shared/infra/http/throttle-by-account.decorator';
import { AppThrottlerGuard } from '#shared/infra/http/throttler.guard';
import { QueueRedisConnection } from '#shared/infra/redis/queue-redis.connection';
import { RedisModule } from '#shared/infra/redis/redis.module';
import { OutboxModule } from '#shared/infra/outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ENV_FILES,
      ignoreEnvFile: ignoresEnvFiles(),
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, QueueRedisConnection, Logger],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        connection: QueueRedisConnection,
        logger: Logger,
      ) => {
        const enabled = () => config.get('THROTTLE_ENABLED', { infer: true }) !== 'false';
        return {
          throttlers: [{ ttl: seconds(60), limit: 100 }, ...accountThrottlers(enabled)],
          // contadores no Redis: com N instâncias, o limite vale para a soma, e não para cada uma
          storage: new RedisThrottlerStorage(connection.commands, logger),
          skipIf: () => !enabled(),
        };
      },
    }),
    ObservabilityModule,
    ProblemDetailsModule,
    JwtConfigModule,
    AuthModule.forRoot({ imports: [IdentityAuthModule] }),
    RuntimeModule,
    DatabaseModule,
    RedisModule,
    AppCacheModule,
    HealthModule,
    OutboxModule,
    CatalogModule,
    IdentityModule,
    InventoryModule,
    OrdersModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
