import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { AppThrottlerGuard } from './throttler.guard.js';

class ExposedGuard extends AppThrottlerGuard {
  set(res: Record<string, unknown>, name: string, value: number) {
    this.setResponseHeader(res, name, value);
  }
}

function headersAfter(name: string) {
  const headers: Record<string, unknown> = {};
  const res = { header: (key: string, value: unknown) => (headers[key] = value) };
  const guard = new ExposedGuard({ throttlers: [] }, {} as ThrottlerStorage, new Reflector());
  guard.set(res, name, 42);
  return headers;
}

describe('AppThrottlerGuard', () => {
  it('grava o Retry-After de um throttler nomeado sem o sufixo', () => {
    expect(headersAfter('Retry-After-account-minute')).toEqual({ 'Retry-After': 42 });
  });

  it('mantém o sufixo nos X-RateLimit-*', () => {
    expect(headersAfter('X-RateLimit-Limit-account-minute')).toEqual({
      'X-RateLimit-Limit-account-minute': 42,
    });
  });
});
