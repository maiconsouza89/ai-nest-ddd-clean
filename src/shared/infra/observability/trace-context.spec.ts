import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { currentTraceparent, runInEventTrace } from './trace-context';

const activeTraceId = () => trace.getActiveSpan()?.spanContext().traceId;

describe('trace-context', () => {
  beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    trace.setGlobalTracerProvider(new TracerProvider());
    // o NodeSDK registra este propagador no app real
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });
  afterAll(() => {
    context.disable();
    trace.disable();
    propagation.disable();
  });

  it('sem span ativo, não há traceparent', () => {
    expect(currentTraceparent()).toBeUndefined();
  });

  it('o handler roda no mesmo trace da requisição que gravou o evento', async () => {
    const http = trace.getTracer('test').startSpan('POST /orders/:id/pay');
    const { traceparent, requestTraceId } = context.with(trace.setSpan(context.active(), http), () => ({
      traceparent: currentTraceparent(),
      requestTraceId: activeTraceId(),
    }));
    expect(traceparent).toContain(requestTraceId!);

    // depois, no worker: outro contexto, sem relação com a requisição
    const seen = await runInEventTrace('outbox.publish', traceparent, {}, async () => activeTraceId());

    expect(seen).toBe(requestTraceId);
  });
});
