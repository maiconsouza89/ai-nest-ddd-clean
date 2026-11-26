import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Actor } from '#shared/application/actor';
import type { Page } from '#shared/application/page';
import { ApiPageResponse } from '#shared/infra/http/page.response';
import { PaginationQuery } from '#shared/infra/http/pagination.query';
import { CurrentUser } from '#shared/infra/auth/current-user.decorator';
import { OrderQueries } from '../../../application/queries/order.queries.js';
import { CancelOrderUseCase } from '../../../application/use-cases/cancel-order.use-case.js';
import { CreateOrderUseCase } from '../../../application/use-cases/create-order.use-case.js';
import { GetOrderUseCase } from '../../../application/use-cases/get-order.use-case.js';
import { PayOrderUseCase } from '../../../application/use-cases/pay-order.use-case.js';
import { PlaceOrderUseCase } from '../../../application/use-cases/place-order.use-case.js';
import { CreateOrderRequest } from '../dtos/create-order.request.js';
import {
  CreatedOrderResponse,
  OrderDetailsResponse,
  OrderListItemResponse,
} from '../dtos/order.responses.js';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly placeOrder: PlaceOrderUseCase,
    private readonly payOrder: PayOrderUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
    private readonly orderQueries: OrderQueries,
  ) {}

  @Get()
  @ApiPageResponse(OrderListItemResponse)
  list(
    @Query() query: PaginationQuery,
    @CurrentUser() actor: Actor,
  ): Promise<Page<OrderListItemResponse>> {
    return this.orderQueries.listByCustomer(actor.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderDetailsResponse })
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ): Promise<OrderDetailsResponse> {
    return this.getOrder.execute({ orderId: id, actor });
  }

  @Post()
  @ApiCreatedResponse({ type: CreatedOrderResponse, description: 'Pedido criado em `DRAFT`.' })
  create(
    @Body() body: CreateOrderRequest,
    @CurrentUser() actor: Actor,
  ): Promise<CreatedOrderResponse> {
    return this.createOrder.execute({ customerId: actor.id, items: body.items });
  }

  @Post(':id/place')
  @HttpCode(204)
  async place(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) {
    await this.placeOrder.execute({ orderId: id, actor });
  }

  @Post(':id/pay')
  @HttpCode(204)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Repetir a chamada com a mesma chave não cobra de novo e devolve a mesma resposta.',
  })
  async pay(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.payOrder.execute({ orderId: id, actor, idempotencyKey });
  }

  @Post(':id/cancel')
  @HttpCode(204)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) {
    await this.cancelOrder.execute({ orderId: id, actor });
  }
}
