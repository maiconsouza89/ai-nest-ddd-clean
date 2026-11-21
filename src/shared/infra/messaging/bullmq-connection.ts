import { OnApplicationShutdown, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Logger } from '../../application/ports/logger';
import { EnvironmentVariables } from '../config/env.validation';

/**
 * Duas conexões ioredis para o mesmo `REDIS_URL` (a do cache usa o cliente `redis`).
 *
 * - `producer`: usada por quem enfileira (o relay da outbox). Sem fila offline, para falhar na hora com o
 *   Redis fora do ar; o relay então registra a falha e tenta de novo com backoff.
 * - `worker`: `maxRetriesPerRequest: null`, exigido pelo BullMQ nos workers, que esperam o Redis voltar.
 */
@Injectable()
export class BullMqConnection implements OnApplicationShutdown {
  readonly producer: IORedis;
  readonly worker: IORedis;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    logger: Logger,
  ) {
    const url = config.getOrThrow('REDIS_URL', { infer: true });
    this.producer = new IORedis(url, { enableOfflineQueue: false });
    this.worker = new IORedis(url, { maxRetriesPerRequest: null });
    // sem listener, um erro de conexão derruba o processo; o ioredis reconecta sozinho
    for (const [name, client] of [['producer', this.producer], ['worker', this.worker]] as const) {
      client.on('error', (err) => logger.warn({ err, connection: name }, 'bullmq redis connection error'));
    }
  }

  onApplicationShutdown() {
    this.producer.disconnect();
    this.worker.disconnect();
  }
}
