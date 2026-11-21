import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/infra/identity.module';
import { InventoryModule } from './modules/inventory/infra/inventory.module';
import { OrdersModule } from './modules/orders/infra/orders.module';
import { ClockModule } from './shared/infra/clock/clock.module';
import { AuthModule } from './shared/infra/auth/auth.module';
import { validateEnv } from './shared/infra/config/env.validation';
import { DatabaseModule } from './shared/infra/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate: validateEnv,
    }),
    AuthModule,
    ClockModule,
    DatabaseModule,
    CatalogModule,
    IdentityModule,
    InventoryModule,
    OrdersModule,
  ],
})
export class AppModule {}
