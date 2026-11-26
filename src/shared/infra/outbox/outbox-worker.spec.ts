import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventTransportUnavailableError } from '../../application/ports/event-publisher.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { DEFAULT_OUTBOX_OPTIONS, OutboxRelay } from './outbox-relay.js';
import { OutboxWorker } from './outbox-worker.js';

const unavailable = () => new EventTransportUnavailableError(new Error('redis fora do ar'));

/** Relay falso: cada rodada consome o próximo resultado da lista (um erro rejeita) e anota a hora. */
function fakeRelay(results: (number | Error)[]) {
  const calls: number[] = [];
  const relay = {
    options: DEFAULT_OUTBOX_OPTIONS,
    runOnce: () => {
      calls.push(Date.now());
      const next = results.shift() ?? 0;
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
  };
  return { relay: relay as unknown as OutboxRelay, calls };
}

const config = {
  get: () => 'true',
} as unknown as ConfigService<EnvironmentVariables, true>;

describe('OutboxWorker', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const gaps = (calls: number[]) => calls.slice(1).map((t, i) => t - calls[i]);

  it('com o transporte fora, a espera dobra até 30 s e volta ao normal quando ele volta', async () => {
    const { relay, calls } = fakeRelay([...Array.from({ length: 7 }, unavailable), 0, 0]);
    const worker = new OutboxWorker(relay, config);

    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 8_000 + 16_000 + 30_000 + 30_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await worker.onModuleDestroy();

    // sete rodadas na pausa, a volta, e a espera comum de 1 s
    expect(gaps(calls).slice(0, 8)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 1_000,
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      { error: 'redis fora do ar' },
      'outbox relay paused: event transport unavailable',
    );
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('outbox relay resumed');
    expect(error).not.toHaveBeenCalled();
  });

  it('cada pausa loga a entrada uma vez, e a espera recomeça em 1 s', async () => {
    const { relay, calls } = fakeRelay([unavailable(), unavailable(), 0, unavailable(), 0]);
    const worker = new OutboxWorker(relay, config);

    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 1_000 + 1_000 + 1_000);
    await worker.onModuleDestroy();

    expect(gaps(calls).slice(0, 4)).toEqual([1_000, 2_000, 1_000, 1_000]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('um erro que não é de transporte continua no log de lote falho, sem pausa', async () => {
    const { relay, calls } = fakeRelay([new Error('postgres fora'), 0]);
    const worker = new OutboxWorker(relay, config);

    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000);
    await worker.onModuleDestroy();

    expect(gaps(calls)[0]).toBe(1_000);
    expect(error).toHaveBeenCalledWith(
      'Outbox batch failed',
      expect.stringContaining('postgres fora'),
    );
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('um outro erro no meio da pausa a encerra: a pausa seguinte loga de novo e recomeça em 1 s', async () => {
    const { relay, calls } = fakeRelay([
      unavailable(),
      new Error('postgres fora'),
      unavailable(),
      0,
    ]);
    const worker = new OutboxWorker(relay, config);

    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000 + 1_000 + 1_000);
    await worker.onModuleDestroy();

    expect(gaps(calls).slice(0, 3)).toEqual([1_000, 1_000, 1_000]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('o desligamento acorda o worker no meio da pausa', async () => {
    const { relay, calls } = fakeRelay(Array.from({ length: 20 }, unavailable));
    const worker = new OutboxWorker(relay, config);

    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 8_000 + 16_000);
    const rounds = calls.length;
    // a próxima espera é de 30 s; o desligamento não espera por ela
    await worker.onModuleDestroy();

    expect(calls).toHaveLength(rounds);
  });
});
