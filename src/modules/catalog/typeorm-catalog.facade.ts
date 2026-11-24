import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { In, Repository } from 'typeorm';
import { CatalogFacade, ProductPrice } from './contracts/catalog.facade.js';
import { ProductOrmEntity } from './product.orm-entity.js';

@Injectable()
export class TypeOrmCatalogFacade implements CatalogFacade {
  constructor(
    @InjectRepository(ProductOrmEntity) private readonly products: Repository<ProductOrmEntity>,
  ) {}

  async pricesOf(productIds: string[]): Promise<ProductPrice[]> {
    // os ids vêm de outro módulo e podem não ser uuids válidos; o banco recusaria a consulta
    const ids = productIds.filter((id) => isUUID(id));
    if (ids.length === 0) return [];
    const rows = await this.products.find({
      where: { id: In(ids) },
      select: { id: true, priceCents: true, currency: true },
    });
    return rows.map((p) => ({ productId: p.id, priceCents: p.priceCents, currency: p.currency }));
  }
}
// teste do CI: PR só do catalog
