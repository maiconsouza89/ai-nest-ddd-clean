import { ConfigService } from '@nestjs/config';
import { seconds, type ThrottlerAsyncOptions } from '@nestjs/throttler';
import { Logger } from '../../../application/ports/logger.js';
import { EnvironmentVariables } from '../../config/env.validation.js';
import { QueueRedisConnection } from '../../redis/queue-redis.connection.js';
import { RedisThrottlerStorage } from './redis-throttler-storage.js';
import { accountThrottlers } from './throttle-by-account.decorator.js';

/** Opções do `ThrottlerModule.forRootAsync`: o limite por IP, os limites por conta e o storage no Redis. */
export const rateLimitOptions: ThrottlerAsyncOptions = {
  inject: [ConfigService, QueueRedisConnection, Logger],
  useFactory: (
    config: ConfigService<EnvironmentVariables, true>,
    connection: QueueRedisConnection,
    logger: Logger,
  ) => {
    const enabled = () => config.get('THROTTLE_ENABLED', { infer: true }) !== 'false';
    return {
      throttlers: [{ ttl: seconds(60), limit: 100 }, ...accountThrottlers(enabled)],
      // contadores no Redis: com N instâncias, o limite vale para a soma, e não para cada uma
      storage: new RedisThrottlerStorage(connection.commands, logger),
      skipIf: () => !enabled(),
    };
  },
};
