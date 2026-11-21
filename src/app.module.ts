import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OrdersModule } from './modules/orders/infra/orders.module';
import { DevAuthGuard } from './shared/infra/auth/dev-auth.guard';

@Module({
  imports: [OrdersModule],
  providers: [{ provide: APP_GUARD, useClass: DevAuthGuard }],
})
export class AppModule {}
