import { ProductOrmEntity } from '../../src/modules/catalog/product.orm-entity';
import { CreateCatalogSchema1795239947000 } from '../../src/modules/catalog/database/migrations/1795239947000-create-catalog-schema';
import { CreateCatalogProducts1795239947723 } from '../../src/modules/catalog/database/migrations/1795239947723-create-catalog-products';
import { startDatabase } from './database';

export const startCatalogDatabase = () =>
  startDatabase({
    entities: [ProductOrmEntity],
    migrations: [CreateCatalogSchema1795239947000, CreateCatalogProducts1795239947723],
    migrationsTableName: 'catalog_migrations',
  });
