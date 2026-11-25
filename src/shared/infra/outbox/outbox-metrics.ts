import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { metrics } from '@opentelemetry/api';
import type { BatchObservableCallback, Meter, Observable } from '@opentelemetry/api';
import { DataSource } from 'typeorm';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { withTimeout } from '../resilience/with-timeout.js';

const COLLECT_TIMEOUT_MS = 5_000;

// o mesmo predicado do IDX_shared_outbox_pending; os mortos usam o IDX_shared_outbox_dead
const PENDING = `"publishedAt" IS NULL AND "deadAt" IS NULL`;
const QUERY = `SELECT
  (SELECT count(*) FROM shared.outbox WHERE ${PENDING}) AS pending,
  (SELECT EXTRACT(EPOCH FROM now() - min("createdAt")) FROM shared.outbox WHERE ${PENDING}) AS "oldestAge",
  (SELECT count(*) FROM shared.outbox WHERE "deadAt" IS NOT NULL) AS dead`;

// o `pg` devolve `count` (bigint) e `EXTRACT` (numeric) como texto
type Row = { pending: string; oldestAge: string | null; dead: string };

/**
 * Gauges da outbox: eventos pendentes e mortos (`outbox.events`) e a idade do pendente mais antigo
 * (`outbox.oldest_pending.age`). Os valores são globais e saem de uma consulta só, a cada coleta do SDK.
 * Coleta só nas instâncias com o worker da outbox; o painel agrega as instâncias com `max`.
 */
@Injectable()
export class OutboxMetrics implements OnApplicationBootstrap, OnModuleDestroy {
  private registration?: {
    meter: Meter;
    callback: BatchObservableCallback;
    observables: Observable[];
  };

  constructor(
    private readonly ds: DataSource,
    private readonly logger: Logger,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('OUTBOX_WORKER_ENABLED') !== 'true') return;
    // pedido aqui, e não no topo do arquivo: a API de métricas não tem proxy, e um meter pedido antes do
    // `MeterProvider` do SDK ficaria noop para sempre. Com `OTEL_METRICS_EXPORTER=none`, ele é noop e o
    // callback nunca roda
    const meter = metrics.getMeter('outbox');
    const events = meter.createObservableGauge('outbox.events', {
      description: 'Eventos da outbox por estado: pendentes de publicação e mortos.',
      unit: '{event}',
    });
    const oldestAge = meter.createObservableGauge('outbox.oldest_pending.age', {
      description: 'Idade do evento pendente mais antigo da outbox; 0 sem pendente.',
      unit: 's',
    });
    const callback: BatchObservableCallback = async (result) => {
      let row: Row;
      try {
        [row] = await withTimeout(() => this.ds.query<Row[]>(QUERY), COLLECT_TIMEOUT_MS);
      } catch (err) {
        // não observa nada nesta coleta; com a temporalidade cumulativa, o SDK repete o último valor
        this.logger.warn({ err }, 'outbox metrics collection failed');
        return;
      }
      result.observe(events, Number(row.pending), { 'outbox.event.state': 'pending' });
      result.observe(events, Number(row.dead), { 'outbox.event.state': 'dead' });
      result.observe(oldestAge, Number(row.oldestAge ?? 0));
    };
    const observables = [events, oldestAge];
    meter.addBatchObservableCallback(callback, observables);
    this.registration = { meter, callback, observables };
  }

  // fase 1 do desligamento: a última exportação do SDK (TracingShutdown, fase 4) roda com o DataSource
  // já fechado, e o callback falharia no fim de todo desligamento
  onModuleDestroy() {
    if (!this.registration) return;
    const { meter, callback, observables } = this.registration;
    meter.removeBatchObservableCallback(callback, observables);
    this.registration = undefined;
  }
}
