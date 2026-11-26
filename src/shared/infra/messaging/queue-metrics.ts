import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { metrics } from '@opentelemetry/api';
import type { BatchObservableCallback, BatchObservableResult } from '@opentelemetry/api';
import { MetricNames, TelemetryAttributes } from 'bullmq';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { withTimeout } from '../resilience/with-timeout.js';
import { BullMqConnection } from './bullmq-connection.js';
import { EventSubscriptions, openEventQueue } from './event-subscriptions.js';

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
  private shutdown?: () => Promise<void>;

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
    const queues = this.subscriptions
      .all()
      .map(({ name }) => openEventQueue(name, this.connection.producer, this.logger));
    const gauge = meter.createObservableGauge(MetricNames.QueueJobsCount, {
      description: 'Jobs por estado em cada fila de eventos.',
      unit: '{job}',
    });
    const collect = async (result: BatchObservableResult) => {
      // um prazo por fila: uma fila lenta ou com falha não esconde as outras, e fica sem ponto nesta coleta
      const counts = await Promise.allSettled(
        queues.map((q) => withTimeout(() => q.getJobCounts(...STATES), COLLECT_TIMEOUT_MS)),
      );
      counts.forEach((count, i) => {
        const queue = queues[i].name;
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
    let collecting: Promise<void> | undefined;
    const callback: BatchObservableCallback = (result) => (collecting = collect(result));
    meter.addBatchObservableCallback(callback, [gauge]);
    this.shutdown = async () => {
      meter.removeBatchObservableCallback(callback, [gauge]);
      // fechar a fila no meio de um getJobCounts faria a coleta em andamento falhar
      await collecting;
      await Promise.all(queues.map((q) => q.close()));
    };
  }

  // fase 1 do desligamento: a última exportação do SDK (fase 4) roda com o Redis já desconectado
  async onModuleDestroy() {
    await this.shutdown?.();
    this.shutdown = undefined;
  }
}
