import dataSource from '../inventory.data-source.js';
import { runSeed } from '#shared/infra/database/run-seed';
import { seedInventory } from './inventory.seed.js';

void runSeed(dataSource, seedInventory);
