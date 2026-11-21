import { backoffDelayMs, DEFAULT_OUTBOX_OPTIONS } from './outbox-relay';

describe('backoffDelayMs', () => {
  const options = { ...DEFAULT_OUTBOX_OPTIONS, baseDelayMs: 1_000, maxDelayMs: 10_000 };

  it('dobra a espera a cada falha', () => {
    expect([1, 2, 3, 4].map((n) => backoffDelayMs(n, options))).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it('nunca passa do máximo', () => {
    expect(backoffDelayMs(5, options)).toBe(10_000);
    expect(backoffDelayMs(50, options)).toBe(10_000);
  });
});
