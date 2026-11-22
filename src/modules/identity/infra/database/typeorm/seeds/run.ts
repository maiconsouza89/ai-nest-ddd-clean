import dataSource from '../identity.data-source.js';
import { runSeed } from '#shared/infra/database/run-seed';
import { seedIdentity } from './identity.seed.js';

void runSeed(dataSource, seedIdentity);
