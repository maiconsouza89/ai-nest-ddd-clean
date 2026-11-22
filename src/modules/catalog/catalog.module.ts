import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { UuidV7Generator } from '#shared/infra/ids/uuid-v7.generator';
import { CatalogFacade } from './contracts/catalog.facade.js';
import { ProductOrmEntity } from './product.orm-entity.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { TypeOrmCatalogFacade } from './typeorm-catalog.facade.js';

// Global de propósito: a regra "módulos só via contracts" proíbe que o orders importe
// este arquivo. O orders injeta a CatalogFacade (de contracts/) sem conhecer o módulo.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ProductOrmEntity])],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    { provide: IdGenerator, useClass: UuidV7Generator },
    { provide: CatalogFacade, useClass: TypeOrmCatalogFacade },
  ],
  exports: [CatalogFacade], // nada além da facade sai do módulo
})
export class CatalogModule {}
