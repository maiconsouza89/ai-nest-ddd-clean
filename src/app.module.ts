import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { validateEnv } from '#shared/infra/config/env.validation';
import { HealthModule } from '#shared/infra/health/health.module';
import { DatabaseModule } from '#shared/infra/database/database.module';
import { ObservabilityModule } from '#shared/infra/observability/observability.module';
import { ENV_FILES, ignoresEnvFiles } from '#shared/infra/config/load-env-files';
import { ProblemDetailsModule } from '#shared/infra/http/problem-details.module';
import { rateLimitOptions } from '#shared/infra/http/rate-limit/rate-limit.options';
import { AppThrottlerGuard } from '#shared/infra/http/rate-limit/throttler.guard';
import { RedisModule } from '#shared/infra/redis/redis.module';
import { OutboxModule } from '#shared/infra/outbox/outbox.module';

@Module({
  imports: [
    // fundação: portas que todo módulo usa. Sobe primeiro e, por ser global, desliga por último
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ENV_FILES,
      ignoreEnvFile: ignoresEnvFiles(),
      validate: validateEnv,
    }),
    ObservabilityModule,
    RuntimeModule,
    // conexões: criam os clientes do Postgres e do Redis e os fecham no desligamento
    DatabaseModule,
    RedisModule,
    // capacidades: usam as conexões e nunca as criam
    OutboxModule,
    AppCacheModule,
    ThrottlerModule.forRootAsync(rateLimitOptions),
    // HTTP: respostas de erro, autenticação e sondas do orquestrador
    ProblemDetailsModule,
    JwtConfigModule,
    AuthModule.forRoot({ imports: [IdentityAuthModule] }),
    HealthModule,
    // negócio
    CatalogModule,
    IdentityModule,
    InventoryModule,
    OrdersModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
