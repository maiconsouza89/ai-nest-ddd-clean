/** Evento público de um módulo, pronto para sair do processo. Só primitivos. */
export type IntegrationEvent = {
  /** Único por evento: base da idempotência dos consumidores. */
  eventId: string;
  type: string;
  version: number;
  /** ISO 8601 */
  occurredAt: string;
  payload: Record<string, unknown>;
  /** Dados técnicos que não fazem parte do contrato de negócio (ex.: contexto de tracing). */
  metadata?: EventMetadata;
};

export type EventMetadata = {
  /** W3C Trace Context: liga o handler à requisição que originou o evento. */
  traceparent?: string;
};
