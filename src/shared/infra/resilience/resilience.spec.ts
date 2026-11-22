import { describe, it, expect } from 'vitest';
import { retry } from './retry.js';
import { TimeoutError, withTimeout } from './with-timeout.js';

const never = () => new Promise<never>(() => undefined);

describe('withTimeout', () => {
  it('devolve o resultado quando termina a tempo', async () => {
    await expect(withTimeout(async () => 'ok', 50)).resolves.toBe('ok');
  });

  it('rejeita com TimeoutError quando estoura', async () => {
    await expect(withTimeout(never, 10)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('propaga o erro do próprio trabalho', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });
});

describe('retry', () => {
  const opts = { attempts: 3, baseDelayMs: 1, shouldRetry: () => true };

  it('repete até dar certo', async () => {
    let calls = 0;
    const result = await retry(async () => {
      if (++calls < 3) throw new Error('falha');
      return 'ok';
    }, opts);
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('desiste depois de `attempts` e propaga o último erro', async () => {
    let calls = 0;
    await expect(
      retry(async () => {
        calls++;
        throw new Error(`falha ${calls}`);
      }, opts),
    ).rejects.toThrow('falha 3');
    expect(calls).toBe(3);
  });

  it('não repete erro que shouldRetry recusa', async () => {
    let calls = 0;
    await expect(
      retry(
        async () => {
          calls++;
          throw new Error('definitivo');
        },
        { ...opts, shouldRetry: () => false },
      ),
    ).rejects.toThrow('definitivo');
    expect(calls).toBe(1);
  });
});
