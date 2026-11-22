import dataSource from '../catalog.data-source.js';
import { runSeed } from '#shared/infra/database/run-seed';
import { seedCatalog } from './catalog.seed.js';

void runSeed(dataSource, seedCatalog);
