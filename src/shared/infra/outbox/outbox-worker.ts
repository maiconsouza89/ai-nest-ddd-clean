import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventTransportUnavailableError } from '../../application/ports/event-publisher.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { backoffDelayMs, OutboxRelay } from './outbox-relay.js';

const POLL_INTERVAL_MS = 1_000;
// pausa com o transporte fora: 1 s, 2 s, 4 s... até 30 s; com o Redis de volta, a entrega recomeça em até 30 s
const PAUSE_BASE_MS = 1_000;
const PAUSE_MAX_MS = 30_000;
const PAUSE_BACKOFF = { baseDelayMs: PAUSE_BASE_MS, maxDelayMs: PAUSE_MAX_MS };
const CLEANUP_INTERVAL_MS = 60 * 60_000;

/** Laço em segundo plano: entrega lotes da outbox e, de tempos em tempos, limpa os antigos. */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private running = false;
  private loop?: Promise<void>;
  private wake?: () => void;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly relay: OutboxRelay,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('OUTBOX_WORKER_ENABLED') !== 'true') return;
    this.running = true;
    this.loop = this.run();
    this.cleanupTimer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  async onModuleDestroy() {
    this.running = false;
    clearInterval(this.cleanupTimer);
    this.wake?.();
    await this.loop;
  }

  private async run() {
    // rodadas seguidas com o transporte fora; 0 fora da pausa
    let pausedRounds = 0;
    while (this.running) {
      let handled = 0;
      let error: unknown;
      try {
        handled = await this.relay.runOnce();
      } catch (caught) {
        error = caught;
      }
      if (error instanceof EventTransportUnavailableError) {
        // só a entrada na pausa loga: as rodadas seguintes falham pelo mesmo motivo
        if (pausedRounds === 0) {
          const cause = error.cause instanceof Error ? error.cause.message : String(error.cause);
          this.logger.warn({ error: cause }, 'outbox relay paused: event transport unavailable');
        }
        await this.sleep(backoffDelayMs(++pausedRounds, PAUSE_BACKOFF));
        continue;
      }
      // a primeira rodada sem a falha de transporte, mesmo com outro erro, encerra a pausa
      if (pausedRounds > 0) {
        this.logger.log('outbox relay resumed');
        pausedRounds = 0;
      }
      if (error !== undefined) {
        this.logger.error('Outbox batch failed', error instanceof Error ? error.stack : error);
      }
      // lote cheio: ainda deve haver pendentes, volta logo
      if (handled < this.relay.options.batchSize) await this.sleep(POLL_INTERVAL_MS);
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  private async cleanup() {
    try {
      const deleted = await this.relay.cleanup();
      if (deleted > 0) this.logger.log(`Outbox cleanup removed ${deleted} published events`);
    } catch (error) {
      this.logger.error('Outbox cleanup failed', error instanceof Error ? error.stack : error);
    }
  }
}
