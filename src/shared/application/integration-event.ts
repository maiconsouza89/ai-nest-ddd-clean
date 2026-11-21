/** Evento público de um módulo, pronto para sair do processo. Só primitivos. */
export type IntegrationEvent = {
  /** Único por evento: base da idempotência dos consumidores. */
  eventId: string;
  type: string;
  version: number;
  /** ISO 8601 */
  occurredAt: string;
  payload: Record<string, unknown>;
};
