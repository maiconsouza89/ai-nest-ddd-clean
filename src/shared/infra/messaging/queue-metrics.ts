import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { metrics } from '@opentelemetry/api';
import type { BatchObservableCallback, Meter, ObservableGauge } from '@opentelemetry/api';
import { MetricNames, Queue, TelemetryAttributes } from 'bullmq';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { withTimeout } from '../resilience/with-timeout.js';
import { BullMqConnection } from './bullmq-connection.js';
import { EventSubscriptions, queueNameOf } from './event-subscriptions.js';

const COLLECT_TIMEOUT_MS = 5_000;
// o `failed` é a fila de mortos de cada consumidor
const STATES = ['waiting', 'active', 'delayed', 'failed'] as const;

/**
 * Gauge `bullmq.queue.jobs`: jobs por estado em cada fila `events.<consumidor>`, com os nomes da telemetria
 * do próprio BullMQ. Os valores são globais (o Redis é um só): coleta só nas instâncias com os workers das
 * filas, e o painel agrega as instâncias com `max`.
 */
@Injectable()
export class QueueMetrics implements OnApplicationBootstrap, OnModuleDestroy {
  private queues: Queue[] = [];
  private registration?: {
    meter: Meter;
    callback: BatchObservableCallback;
    gauge: ObservableGauge;
  };

  constructor(
    private readonly subscriptions: EventSubscriptions,
    private readonly connection: BullMqConnection,
    private readonly logger: Logger,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('QUEUE_WORKERS_ENABLED') !== 'true') return;
    // pedido aqui, e não no topo do arquivo: um meter pedido antes do `MeterProvider` do SDK fica noop
    const meter = metrics.getMeter('messaging');
    // o `all()` varre os providers se o EventSubscriptions ainda não o fez: a ordem dos hooks não importa
    this.queues = this.subscriptions.all().map(({ name: consumer }) => {
      const queue = new Queue(queueNameOf(consumer), { connection: this.connection.producer });
      // erro de conexão sem listener derrubaria o processo
      queue.on('error', (err) => this.logger.warn({ err, consumer }, 'event queue error'));
      return queue;
    });
    const gauge = meter.createObservableGauge(MetricNames.QueueJobsCount, {
      description: 'Jobs por estado em cada fila de eventos.',
      unit: '{job}',
    });
    const callback: BatchObservableCallback = async (result) => {
      let counts: PromiseSettledResult<Record<string, number>>[];
      try {
        counts = await withTimeout(
          () => Promise.allSettled(this.queues.map((q) => q.getJobCounts(...STATES))),
          COLLECT_TIMEOUT_MS,
        );
      } catch (err) {
        this.logger.warn({ err }, 'queue metrics collection failed');
        return;
      }
      // uma fila que falha não esconde as outras: fica sem ponto nesta coleta
      counts.forEach((count, i) => {
        const queue = this.queues[i].name;
        if (count.status === 'rejected') {
          this.logger.warn({ err: count.reason, queue }, 'queue metrics collection failed');
          return;
        }
        for (const state of STATES) {
          result.observe(gauge, count.value[state] ?? 0, {
            [TelemetryAttributes.QueueName]: queue,
            [TelemetryAttributes.QueueJobsState]: state,
          });
        }
      });
    };
    meter.addBatchObservableCallback(callback, [gauge]);
    this.registration = { meter, callback, gauge };
  }

  // fase 1 do desligamento: a última exportação do SDK (fase 4) roda com o Redis já desconectado
  async onModuleDestroy() {
    if (this.registration) {
      const { meter, callback, gauge } = this.registration;
      meter.removeBatchObservableCallback(callback, [gauge]);
      this.registration = undefined;
    }
    await Promise.all(this.queues.map((q) => q.close()));
    this.queues = [];
  }
}
