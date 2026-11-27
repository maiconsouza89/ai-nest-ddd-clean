import { Global, Module } from '@nestjs/common';
import { Clock } from '../../application/ports/clock.js';
import { IdGenerator } from '../../application/ports/id-generator.js';
import { SystemClock } from './system-clock.js';
import { UuidV7Generator } from './uuid-v7.generator.js';

/** Portas de tempo e de identidade que todo módulo usa, ligadas uma vez para a app inteira. */
@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidV7Generator },
  ],
  exports: [Clock, IdGenerator],
})
export class RuntimeModule {}
