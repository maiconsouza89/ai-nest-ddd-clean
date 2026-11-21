export type IdempotencyClaim = {
  key: string;
  actorId: string;
  /** Impressão digital do pedido: a mesma chave só vale para a mesma requisição. */
  fingerprint: string;
  expiresAt: Date;
  now: Date;
};

export abstract class IdempotencyStore {
  /**
   * Reserva a chave dentro da transação ativa. Devolve `first` para quem reservou e `replay` quando
   * a mesma requisição já foi concluída. Lança IdempotencyKeyReusedError se o fingerprint for outro.
   * A reserva só persiste se a transação confirmar, então uma falha não "queima" a chave.
   */
  abstract claim(input: IdempotencyClaim): Promise<'first' | 'replay'>;
}
