import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogFacade } from './contracts/catalog.facade.js';
import { ProductOrmEntity } from './product.orm-entity.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { TypeOrmCatalogFacade } from './typeorm-catalog.facade.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProductOrmEntity])],
  controllers: [ProductsController],
  providers: [ProductsService, { provide: CatalogFacade, useClass: TypeOrmCatalogFacade }],
  exports: [CatalogFacade], // nada além da facade sai do módulo
})
export class CatalogModule {}
