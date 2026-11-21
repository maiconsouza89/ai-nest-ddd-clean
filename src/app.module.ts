import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { OrdersModule } from './modules/orders/infra/orders.module';
import { DevAuthGuard } from './shared/infra/auth/dev-auth.guard';
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
    DatabaseModule,
    OrdersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: DevAuthGuard }],
})
export class AppModule {}
