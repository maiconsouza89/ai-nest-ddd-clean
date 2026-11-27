import { describe, it, expect } from 'vitest';
import { ReplyError } from 'ioredis';
import { TimeoutError } from '../resilience/with-timeout.js';
import { isTransportFailure } from './transport-failure.js';

// o ReplyError do ioredis vem tipado como `any`
const reply = (message: string) => new (ReplyError as new (m: string) => Error)(message);

describe('isTransportFailure', () => {
  it('o prazo do enfileiramento estourado é do transporte, mesmo com a conexão no ar', () => {
    expect(isTransportFailure(new TimeoutError(5_000), 'ready')).toBe(true);
  });

  it('com a conexão commands fora de ready, qualquer erro é do transporte', () => {
    for (const status of ['connecting', 'reconnecting', 'close', 'end']) {
      expect(isTransportFailure(new Error('qualquer coisa'), status)).toBe(true);
    }
  });

  it('um erro de conexão é do transporte, mesmo com o status ainda em ready', () => {
    expect(isTransportFailure(new Error('Connection is closed.'), 'ready')).toBe(true);
    expect(
      isTransportFailure(
        Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6379'), { code: 'ECONNREFUSED' }),
        'ready',
      ),
    ).toBe(true);
  });

  it('o Redis que responde sem poder gravar é do transporte', () => {
    for (const message of [
      "READONLY You can't write against a read only replica.",
      'LOADING Redis is loading the dataset in memory',
      'MASTERDOWN Link with MASTER is down and replica-serve-stale-data is set to no.',
      "OOM command not allowed when used memory > 'maxmemory'.",
    ]) {
      expect(isTransportFailure(reply(message), 'ready')).toBe(true);
    }
  });

  it('um erro qualquer com a conexão no ar não é do transporte', () => {
    expect(isTransportFailure(new Error('Custom Ids cannot contain :'), 'ready')).toBe(false);
  });

  it('um ReplyError de permissão não é do transporte', () => {
    expect(
      isTransportFailure(reply('NOPERM this user has no permissions to run the command'), 'ready'),
    ).toBe(false);
  });

  it('uma rejeição que não é Error, com a conexão no ar, não é do transporte', () => {
    expect(isTransportFailure('falhou', 'ready')).toBe(false);
  });
});
