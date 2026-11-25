import { describe, it, expect } from 'vitest';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeLogger } from '#test/fakes/fake-logger';
import { Logger } from '../../application/ports/logger.js';
import { ErrorStatusRegistry, provideErrorStatuses } from './error-status.registry.js';
import { ProblemDetailsModule } from './problem-details.module.js';

describe('ErrorStatusRegistry', () => {
  it('devolve o status de um código registrado', () => {
    const registry = new ErrorStatusRegistry();
    registry.register({ ORDER_NOT_FOUND: 404 });
    expect(registry.statusOf('ORDER_NOT_FOUND')).toBe(404);
  });

  it('não tem status para um código desconhecido', () => {
    expect(new ErrorStatusRegistry().statusOf('UNKNOWN')).toBeUndefined();
  });

  it('aceita o mesmo código com o mesmo status', () => {
    const registry = new ErrorStatusRegistry();
    registry.register({ ORDER_NOT_FOUND: 404 });
    expect(() => registry.register({ ORDER_NOT_FOUND: 404 })).not.toThrow();
    expect(registry.statusOf('ORDER_NOT_FOUND')).toBe(404);
  });

  it('recusa o mesmo código com outro status, citando o código e os dois status', () => {
    const registry = new ErrorStatusRegistry();
    registry.register({ INSUFFICIENT_STOCK: 409 });
    expect(() => registry.register({ INSUFFICIENT_STOCK: 422 })).toThrow(
      /INSUFFICIENT_STOCK.*409.*422/,
    );
  });
});

// o ProblemDetailsModule também provê o filtro, que injeta o Logger do ObservabilityModule
@Global()
@Module({ providers: [{ provide: Logger, useClass: FakeLogger }], exports: [Logger] })
class FakeLoggerModule {}

describe('provideErrorStatuses', () => {
  it('registra os status de cada módulo ao compilar, inclusive o CONCURRENCY_CONFLICT do shared', async () => {
    @Module({ providers: [provideErrorStatuses({ A_NOT_FOUND: 404 })] })
    class AModule {}
    @Module({ providers: [provideErrorStatuses({ B_TAKEN: 409 })] })
    class BModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [FakeLoggerModule, ProblemDetailsModule, AModule, BModule],
    }).compile();
    const registry = moduleRef.get(ErrorStatusRegistry);

    expect(registry.statusOf('A_NOT_FOUND')).toBe(404);
    expect(registry.statusOf('B_TAKEN')).toBe(409);
    expect(registry.statusOf('CONCURRENCY_CONFLICT')).toBe(409);
  });

  it('a app não compila se dois módulos dão status diferentes ao mesmo código', async () => {
    @Module({ providers: [provideErrorStatuses({ SAME_CODE: 404 })] })
    class AModule {}
    @Module({ providers: [provideErrorStatuses({ SAME_CODE: 409 })] })
    class BModule {}

    await expect(
      Test.createTestingModule({
        imports: [FakeLoggerModule, ProblemDetailsModule, AModule, BModule],
      }).compile(),
    ).rejects.toThrow(/SAME_CODE/);
  });
});
