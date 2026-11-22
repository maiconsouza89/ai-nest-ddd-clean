import { OnApplicationShutdown, OnModuleInit, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';

const PRODUCER_READY_TIMEOUT_MS = 5_000;

/**
 * Duas conexões ioredis para o mesmo `REDIS_URL` (a do cache usa o cliente `redis`).
 *
 * - `producer`: usada por quem enfileira (o relay da outbox, o agendador de jobs) e pelo storage do rate
 *   limit. Sem fila offline, para falhar na hora com o Redis fora do ar; o relay então registra a falha e
 *   tenta de novo com backoff, e o rate limit responde 503.
 * - `worker`: `maxRetriesPerRequest: null`, exigido pelo BullMQ nos workers, que esperam o Redis voltar.
 */
@Injectable()
export class BullMqConnection implements OnModuleInit, OnApplicationShutdown {
  readonly producer: Redis;
  readonly worker: Redis;

  constructor(config: ConfigService<EnvironmentVariables, true>, logger: Logger) {
    const url = config.getOrThrow('REDIS_URL', { infer: true });
    this.producer = new Redis(url, { enableOfflineQueue: false });
    this.worker = new Redis(url, { maxRetriesPerRequest: null });
    // sem listener, um erro de conexão derruba o processo; o ioredis reconecta sozinho
    for (const [name, client] of [
      ['producer', this.producer],
      ['worker', this.worker],
    ] as const) {
      client.on('error', (err) =>
        logger.warn({ err, connection: name }, 'bullmq redis connection error'),
      );
    }
  }

  /**
   * O `producer` não tem fila offline, então um comando enviado antes da conexão ficar pronta falha (e o rate
   * limit responderia 503 nas primeiras requisições). Espera um pouco; se o Redis estiver fora, segue a subida.
   */
  async onModuleInit() {
    if (this.producer.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.producer.off('ready', done);
        resolve();
      };
      const timer = setTimeout(done, PRODUCER_READY_TIMEOUT_MS);
      this.producer.once('ready', done);
    });
  }

  onApplicationShutdown() {
    this.producer.disconnect();
    this.worker.disconnect();
  }
}
