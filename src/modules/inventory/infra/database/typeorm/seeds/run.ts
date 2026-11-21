import dataSource from '../inventory.data-source';
import { runSeed } from '../../../../../../shared/infra/database/run-seed';
import { seedInventory } from './inventory.seed';

void runSeed(dataSource, seedInventory);
