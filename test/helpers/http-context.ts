import type { ExecutionContext } from '@nestjs/common';

/** ExecutionContext HTTP mínimo, para testar guards sem subir o Nest. */
export function httpContext(req: object): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}
