import { BeforeApplicationShutdown, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@keyv/redis';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';

const RECONNECT_MAX_DELAY_MS = 3_000;

/**
 * Conexão única com o Redis, dona do ciclo de vida do cliente (conecta na subida, fecha no shutdown).
 * O cache e o health check compartilham este cliente. O cache fecha o cliente conectado no shutdown.
 *
 * Sem fila offline: com o Redis fora do ar, o comando falha na hora em vez de ficar pendurado, e quem
 * depende do cache cai para o Postgres. A reconexão acontece em segundo plano.
 */
@Injectable()
export class RedisConnection implements OnModuleInit, BeforeApplicationShutdown {
  readonly client;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly logger: Logger,
  ) {
    this.client = createClient({
      url: config.getOrThrow('REDIS_URL', { infer: true }),
      disableOfflineQueue: true,
      socket: { reconnectStrategy: (retries) => Math.min(retries * 100, RECONNECT_MAX_DELAY_MS) },
    });
    // sem listener, um erro de conexão derruba o processo
    this.client.on('error', (err: Error) => this.logger.warn({ err }, 'redis connection error'));
  }

  onModuleInit() {
    // não bloqueia a subida: a aplicação funciona sem cache, e o /health/ready acusa a falta do Redis
    this.client.connect().catch((err: Error) => this.logger.warn({ err }, 'redis connect failed'));
  }

  beforeApplicationShutdown() {
    // Desconectado e tentando reconectar: o QUIT que o cache envia ao desligar nunca teria resposta e o
    // shutdown travaria. Como este hook roda antes do dele, encerra o cliente de vez e o dele vira no-op.
    if (!this.client.isReady && this.client.isOpen) this.client.destroy();
  }
}
