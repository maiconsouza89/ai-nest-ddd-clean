import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { accountThrottlers, ThrottleByAccount } from './throttle-by-account.decorator.js';

class Routes {
  @ThrottleByAccount((req) => (req.body as { email?: string } | undefined)?.email)
  limited() {
    return undefined;
  }

  open() {
    return undefined;
  }
}

function contextFor(route: 'limited' | 'open', body: object | undefined) {
  // o Reflector lê o metadata da função do método, pela referência
  const handler: unknown = Reflect.get(Routes.prototype, route);
  return {
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

function throttlers(enabled = true) {
  return accountThrottlers(() => enabled);
}

describe('accountThrottlers', () => {
  it('monta os degraus account-minute e account-hour', () => {
    expect(throttlers().map(({ name, limit, ttl }) => ({ name, limit, ttl }))).toEqual([
      { name: 'account-minute', limit: 5, ttl: 60_000 },
      { name: 'account-hour', limit: 20, ttl: 3_600_000 },
    ]);
  });

  it('pula a rota sem @ThrottleByAccount', async () => {
    const [entry] = throttlers();
    expect(await entry.skipIf!(contextFor('open', { email: 'a@b.co' }))).toBe(true);
  });

  it('pula quando o tracker devolve undefined', async () => {
    const [entry] = throttlers();
    expect(await entry.skipIf!(contextFor('limited', {}))).toBe(true);
  });

  it('pula com o throttle desligado', async () => {
    const [entry] = throttlers(false);
    expect(await entry.skipIf!(contextFor('limited', { email: 'a@b.co' }))).toBe(true);
  });

  it('conta a rota marcada, com a chave do tracker', async () => {
    const ctx = contextFor('limited', { email: 'a@b.co' });
    for (const entry of throttlers()) {
      expect(await entry.skipIf!(ctx)).toBe(false);
      expect(await entry.getTracker!({}, ctx)).toBe('a@b.co');
    }
  });
});
