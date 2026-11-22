import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '#shared/infra/auth/roles.decorator';
import { PaginationQuery } from '#shared/infra/http/pagination.query';
import { CreateProductRequest, UpdateProductRequest } from './dtos/product.request.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: PaginationQuery) {
    return this.products.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.get(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() body: CreateProductRequest) {
    return this.products.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateProductRequest) {
    return this.products.update(id, body);
  }
}
