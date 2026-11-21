import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogFacade, ProductPrice } from './contracts/catalog.facade';
import { ProductOrmEntity } from './product.orm-entity';

@Injectable()
export class TypeOrmCatalogFacade implements CatalogFacade {
  constructor(
    @InjectRepository(ProductOrmEntity) private readonly products: Repository<ProductOrmEntity>,
  ) {}

  async pricesOf(productIds: string[]): Promise<ProductPrice[]> {
    if (productIds.length === 0) return [];
    const rows = await this.products.find({
      where: { id: In(productIds) },
      select: { id: true, priceCents: true, currency: true },
    });
    return rows.map((p) => ({ productId: p.id, priceCents: p.priceCents, currency: p.currency }));
  }
}
