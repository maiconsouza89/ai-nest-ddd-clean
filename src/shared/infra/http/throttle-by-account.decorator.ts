import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hours, minutes, type ThrottlerOptions } from '@nestjs/throttler';

/** Devolve a chave da conta a partir do corpo cru (o guard roda antes do `ValidationPipe`), ou `undefined`. */
export type AccountTracker = (req: Record<string, unknown>) => string | undefined;

const ACCOUNT_TRACKER_KEY = 'throttleByAccount';

/**
 * Liga os throttlers por conta (`account-minute` e `account-hour`) na rota. O `shared` não sabe o
 * que é a conta: o módulo da rota passa a função que tira a chave da requisição.
 */
export const ThrottleByAccount = (tracker: AccountTracker) =>
  SetMetadata(ACCOUNT_TRACKER_KEY, tracker);

const reflector = new Reflector();

function accountKey(context: ExecutionContext) {
  const tracker = reflector.getAllAndOverride<AccountTracker | undefined>(ACCOUNT_TRACKER_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  return tracker?.(context.switchToHttp().getRequest<Record<string, unknown>>());
}

/**
 * As entradas do `forRoot` para o limite por conta, em dois degraus. Cada entrada do `forRoot` vale
 * em toda rota com o guard, então elas se pulam onde não há `@ThrottleByAccount`.
 */
export function accountThrottlers(enabled: () => boolean): ThrottlerOptions[] {
  // o skipIf da entrada substitui o comum do forRoot, e não soma: sem repetir o THROTTLE_ENABLED
  // aqui, o throttle desligado continuaria contando por conta
  const skipIf = (context: ExecutionContext) => !enabled() || accountKey(context) === undefined;
  // só roda quando o skipIf deixou passar, então a chave existe
  const getTracker = (_req: Record<string, unknown>, context: ExecutionContext) =>
    accountKey(context) ?? '';
  return [
    { name: 'account-minute', limit: 5, ttl: minutes(1), skipIf, getTracker },
    { name: 'account-hour', limit: 20, ttl: hours(1), skipIf, getTracker },
  ];
}
