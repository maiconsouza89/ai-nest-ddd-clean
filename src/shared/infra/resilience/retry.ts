export type RetryOptions = {
  /** Total de tentativas, contando a primeira. */
  attempts: number;
  /** Espera antes da 2ª tentativa; dobra a cada nova tentativa (backoff exponencial). */
  baseDelayMs: number;
  /** Só erros para os quais devolve true são repetidos; os demais sobem na hora. */
  shouldRetry: (error: unknown) => boolean;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Use só em operação idempotente: repetir uma cobrança sem chave de idempotência cobra duas vezes. */
export async function retry<T>(work: () => Promise<T>, opts: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= opts.attempts || !opts.shouldRetry(error)) throw error;
      await sleep(opts.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
