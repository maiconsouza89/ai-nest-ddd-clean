import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorStatusRegistry, provideErrorStatuses } from './error-status.registry.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

/** Respostas de erro em Problem Details (RFC 9457) e o registro do status de cada código. */
@Global()
@Module({
  providers: [
    ErrorStatusRegistry,
    // por APP_FILTER, e não por useGlobalFilters, para o filtro receber injeção de dependência
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // os códigos dos erros do shared kernel, que qualquer módulo pode deixar chegar ao HTTP
    provideErrorStatuses({ CONCURRENCY_CONFLICT: 409, INVALID_MONEY: 422, CURRENCY_MISMATCH: 422 }),
  ],
  exports: [ErrorStatusRegistry],
})
export class ProblemDetailsModule {}
