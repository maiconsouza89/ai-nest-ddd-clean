export abstract class ProcessedEvents {
  /**
   * Registra que `consumer` tratou o evento. Devolve `true` só para o primeiro que registra;
   * `false` se já havia registro. Dentro de um `tx.run`, o registro some junto se a transação desfizer.
   */
  abstract tryMark(eventId: string, consumer: string): Promise<boolean>;
}
