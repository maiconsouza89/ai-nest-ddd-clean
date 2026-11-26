import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Page } from '#shared/application/page';
import { Roles } from '#shared/infra/auth/roles.decorator';
import { ApiPageResponse } from '#shared/infra/http/page.response';
import { PaginationQuery } from '#shared/infra/http/pagination.query';
import { CreateProductRequest, UpdateProductRequest } from './dtos/product.request.js';
import { ProductResponse } from './dtos/product.response.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiPageResponse(ProductResponse)
  list(@Query() query: PaginationQuery): Promise<Page<ProductResponse>> {
    return this.products.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductResponse })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponse> {
    return this.products.get(id);
  }

  @Post()
  @Roles('admin')
  @ApiCreatedResponse({ type: ProductResponse, description: 'Produto criado.' })
  create(@Body() body: CreateProductRequest): Promise<ProductResponse> {
    return this.products.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOkResponse({ type: ProductResponse })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductRequest,
  ): Promise<ProductResponse> {
    return this.products.update(id, body);
  }
}
