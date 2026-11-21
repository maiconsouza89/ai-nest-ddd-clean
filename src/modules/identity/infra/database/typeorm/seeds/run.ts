import dataSource from '../identity.data-source';
import { runSeed } from '../../../../../../shared/infra/database/run-seed';
import { seedIdentity } from './identity.seed';

void runSeed(dataSource, seedIdentity);
