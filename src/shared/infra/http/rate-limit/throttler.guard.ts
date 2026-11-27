import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * O `ThrottlerGuard` põe o nome do throttler no fim de todo header (`Retry-After-account-minute`).
 * O 429 sai sempre com o `Retry-After` padrão, seja qual for o throttler que bloqueou. Os
 * `X-RateLimit-*` ficam com o sufixo: cada throttler tem o seu limite.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override setResponseHeader(
    res: Record<string, unknown>,
    name: string,
    value: string | number,
  ) {
    super.setResponseHeader(res, name.startsWith('Retry-After') ? 'Retry-After' : name, value);
  }
}
