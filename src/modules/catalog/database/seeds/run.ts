import dataSource from '../catalog.data-source';
import { runSeed } from '../../../../shared/infra/database/run-seed';
import { seedCatalog } from './catalog.seed';

void runSeed(dataSource, seedCatalog);
