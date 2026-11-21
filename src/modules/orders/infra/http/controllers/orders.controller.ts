import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, UseFilters } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../../shared/application/actor';
import { PaginationQuery } from '../../../../../shared/infra/http/pagination.query';
import { CurrentUser } from '../../../../../shared/infra/auth/current-user.decorator';
import { OrderQueries } from '../../../application/queries/order.queries';
import { CancelOrderUseCase } from '../../../application/use-cases/cancel-order.use-case';
import { CreateOrderUseCase } from '../../../application/use-cases/create-order.use-case';
import { PayOrderUseCase } from '../../../application/use-cases/pay-order.use-case';
import { PlaceOrderUseCase } from '../../../application/use-cases/place-order.use-case';
import { CreateOrderRequest } from '../dtos/create-order.request';
import { OrdersDomainErrorFilter } from '../filters/domain-error.filter';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseFilters(OrdersDomainErrorFilter)
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly placeOrder: PlaceOrderUseCase,
    private readonly payOrder: PayOrderUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly orderQueries: OrderQueries,
  ) {}

  @Get()
  list(@Query() query: PaginationQuery, @CurrentUser() actor: Actor) {
    return this.orderQueries.listByCustomer(actor.id, query);
  }

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
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Repetir a chamada com a mesma chave não cobra de novo e devolve a mesma resposta.',
  })
  async pay(
    @Param('id') id: string,
    @CurrentUser() actor: Actor,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.payOrder.execute({ orderId: id, actor, idempotencyKey });
  }

  @Post(':id/cancel')
  @HttpCode(204)
  async cancel(@Param('id') id: string, @CurrentUser() actor: Actor) {
    await this.cancelOrder.execute({ orderId: id, actor });
  }
}
