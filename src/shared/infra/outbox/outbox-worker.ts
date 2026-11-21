import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { OutboxRelay } from './outbox-relay';

const POLL_INTERVAL_MS = 1_000;
const CLEANUP_INTERVAL_MS = 60 * 60_000;

/** Laço em segundo plano: entrega lotes da outbox e, de tempos em tempos, limpa os antigos. */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnApplicationShutdown {
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

  async onApplicationShutdown() {
    this.running = false;
    clearInterval(this.cleanupTimer);
    this.wake?.();
    await this.loop;
  }

  private async run() {
    while (this.running) {
      let handled = 0;
      try {
        handled = await this.relay.runOnce();
      } catch (error) {
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
