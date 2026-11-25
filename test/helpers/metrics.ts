import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import type { Attributes } from '@opentelemetry/api';

/**
 * Liga um `MeterProvider` global com um reader que só coleta quando o teste pede, no lugar do SDK que o
 * `tracing.ts` liga na app. Chame antes do `app.init()`: o código pede o meter nos hooks de subida, e um
 * meter pedido antes do provider fica noop para sempre. No `afterAll`, chame `metrics.disable()`.
 * O reader guarda o último valor de cada série (temporalidade cumulativa): para começar sem os pontos de
 * outro teste, ligue um provider novo por teste.
 *
 * Devolve `collectPoints(nome)`: roda uma coleta (e os callbacks dos gauges) e traz os pontos da métrica.
 */
export function startTestMetrics() {
  const reader = new TestMetricReader();
  if (!metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }))) {
    throw new Error('Já há um MeterProvider global: falta o metrics.disable() de outro teste');
  }
  return async function collectPoints(name: string): Promise<MetricPoint[]> {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .filter((metric) => metric.descriptor.name === name)
      .flatMap((metric) => metric.dataPoints as MetricPoint[]);
  };
}

/** Um ponto de gauge ou de contador; o `value` de um histograma seria um objeto. */
export type MetricPoint = { attributes: Attributes; value: number };

class TestMetricReader extends MetricReader {
  protected onShutdown() {
    return Promise.resolve();
  }
  protected onForceFlush() {
    return Promise.resolve();
  }
}
