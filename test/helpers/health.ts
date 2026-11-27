import { HealthIndicatorService } from '@nestjs/terminus';

const indicators = new HealthIndicatorService();

/**
 * `pingCheck` falso para o `TypeOrmHealthIndicator` e o `RedisHealthIndicator`. Devolve o builder real
 * do Terminus: qualquer encadeamento do controller (`.withTimeout()` etc.) funciona.
 */
export const fakePing =
  (isUp: (key: string) => boolean = () => true) =>
  (key: string) =>
    indicators.check(key).attempt(() => {
      if (!isUp(key)) throw new Error(`${key} down`);
    });
