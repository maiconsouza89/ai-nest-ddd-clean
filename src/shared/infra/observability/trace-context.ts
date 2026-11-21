import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

/** `traceparent` do span ativo, para gravar junto do evento. */
export function currentTraceparent(): string | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier.traceparent;
}

/**
 * Roda `work` num span filho do trace que gravou o evento: os logs dos handlers
 * saem com o mesmo traceId da requisição HTTP.
 */
export function runInEventTrace<T>(
  name: string,
  traceparent: string | undefined,
  attributes: Record<string, string | number>,
  work: () => Promise<T>,
): Promise<T> {
  const parent = traceparent
    ? propagation.extract(ROOT_CONTEXT, { traceparent })
    : context.active();
  return trace
    .getTracer('outbox')
    .startActiveSpan(name, { kind: SpanKind.CONSUMER, attributes }, parent, async (span) => {
      try {
        return await work();
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
}
