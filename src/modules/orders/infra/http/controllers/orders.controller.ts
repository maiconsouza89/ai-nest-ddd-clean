import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import type { Actor } from '../../../../../shared/application/actor';
import { CurrentUser } from '../../../../../shared/infra/auth/current-user.decorator';
import { CreateOrderUseCase } from '../../../application/use-cases/create-order.use-case';
import { PayOrderUseCase } from '../../../application/use-cases/pay-order.use-case';
import { PlaceOrderUseCase } from '../../../application/use-cases/place-order.use-case';
import { CreateOrderRequest } from '../dtos/create-order.request';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly placeOrder: PlaceOrderUseCase,
    private readonly payOrder: PayOrderUseCase,
  ) {}

  @Post()
  create(@Body() body: CreateOrderRequest, @CurrentUser() actor: Actor) {
    return this.createOrder.execute({ customerId: actor.id, items: body.items });
  }

  @Post(':id/place')
  @HttpCode(204)
  async place(@Param('id') id: string, @CurrentUser() actor: Actor) {
    await this.placeOrder.execute({ orderId: id, actor });
  }

  @Post(':id/pay')
  @HttpCode(204)
  async pay(@Param('id') id: string, @CurrentUser() actor: Actor) {
    await this.payOrder.execute({ orderId: id, actor });
  }
}
