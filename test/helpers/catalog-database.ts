import { ProductOrmEntity } from '#modules/catalog/product.orm-entity';
import { CreateCatalogSchema1795239947000 } from '#modules/catalog/database/migrations/1795239947000-create-catalog-schema';
import { CreateCatalogProducts1795239947723 } from '#modules/catalog/database/migrations/1795239947723-create-catalog-products';
import { ModuleDatabase, startDatabase } from './database.js';

export const catalogDatabase: ModuleDatabase = {
  template: 'catalog',
  entities: [ProductOrmEntity],
  migrations: [CreateCatalogSchema1795239947000, CreateCatalogProducts1795239947723],
  migrationsTableName: 'catalog_migrations',
};

export const startCatalogDatabase = () => startDatabase(catalogDatabase);
