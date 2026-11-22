import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { Page, PageRequest } from '#shared/application/page';
import { CreateProductRequest, UpdateProductRequest } from './dtos/product.request.js';
import { ProductOrmEntity } from './product.orm-entity.js';

// Cadastro simples: sem domain/application separados (ver "Pragmatismo" no guia).
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductOrmEntity) private readonly products: Repository<ProductOrmEntity>,
    private readonly ids: IdGenerator,
  ) {}

  create(input: CreateProductRequest) {
    const { name, priceCents } = input;
    return this.products.save(
      this.products.create({ id: this.ids.next(), name: name.trim(), priceCents }),
    );
  }

  async list({ page, limit }: PageRequest): Promise<Page<ProductOrmEntity>> {
    const [items, total] = await this.products.findAndCount({
      order: { name: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async get(id: string) {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, input: UpdateProductRequest) {
    const product = await this.get(id);
    if (input.name !== undefined) product.name = input.name.trim();
    if (input.priceCents !== undefined) product.priceCents = input.priceCents;
    return this.products.save(product);
  }
}
