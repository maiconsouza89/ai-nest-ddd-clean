import { OnApplicationShutdown, OnModuleInit, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';

const COMMANDS_READY_TIMEOUT_MS = 5_000;

/**
 * Duas conexões ioredis para o mesmo `REDIS_URL`, usadas pelas filas do BullMQ e pelo rate limit (o cache
 * usa a `CacheRedisConnection`, com o cliente `redis`).
 *
 * - `commands`: para comandos que respondem na hora. Usada por quem enfileira (o relay da outbox, o
 *   agendador de jobs), pelo storage do rate limit e pelo health. Sem fila offline, para falhar na hora com
 *   o Redis fora do ar; o relay então pausa, sem contar a falha do evento, e tenta de novo quando o Redis
 *   volta, e o rate limit responde 503.
 * - `blocking`: para os workers do BullMQ, que esperam o Redis voltar. `maxRetriesPerRequest: null`,
 *   exigido pelo BullMQ nos workers.
 */
@Injectable()
export class QueueRedisConnection implements OnModuleInit, OnApplicationShutdown {
  readonly commands: Redis;
  readonly blocking: Redis;

  constructor(config: ConfigService<EnvironmentVariables, true>, logger: Logger) {
    const url = config.getOrThrow('REDIS_URL', { infer: true });
    this.commands = new Redis(url, { enableOfflineQueue: false });
    this.blocking = new Redis(url, { maxRetriesPerRequest: null });
    // sem listener, um erro de conexão derruba o processo; o ioredis reconecta sozinho
    for (const [name, client] of [
      ['commands', this.commands],
      ['blocking', this.blocking],
    ] as const) {
      client.on('error', (err) =>
        logger.warn({ err, connection: name }, 'queue redis connection error'),
      );
    }
  }

  /**
   * O `commands` não tem fila offline, então um comando enviado antes da conexão ficar pronta falha (e o rate
   * limit responderia 503 nas primeiras requisições). Espera um pouco; se o Redis estiver fora, segue a subida.
   */
  async onModuleInit() {
    if (this.commands.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.commands.off('ready', done);
        resolve();
      };
      const timer = setTimeout(done, COMMANDS_READY_TIMEOUT_MS);
      this.commands.once('ready', done);
    });
  }

  onApplicationShutdown() {
    this.commands.disconnect();
    this.blocking.disconnect();
  }
}
