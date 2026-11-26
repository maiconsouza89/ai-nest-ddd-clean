import { isNotConnectionError } from 'bullmq';
import { TimeoutError } from '../resilience/with-timeout.js';

/** Respostas do Redis que dizem que ele não está em condição de gravar, e não que o comando está errado. */
const UNAVAILABLE_REPLIES = ['READONLY', 'LOADING', 'MASTERDOWN', 'OOM'];

/**
 * Diz se a falha ao enfileirar é do transporte (o Redis fora do ar), e não do evento.
 *
 * O status da conexão vem antes da mensagem: com o `producer` fora de `ready`, qualquer erro é da queda, seja
 * qual for o texto. A mensagem muda entre versões do ioredis (`Stream isn't writeable...`,
 * `MaxRetriesPerRequestError`, `Connection is closed`) e só é lida quando a conexão diz que está no ar.
 */
export function isTransportFailure(error: unknown, producerStatus: string): boolean {
  if (error instanceof TimeoutError) return true;
  if (producerStatus !== 'ready') return true;
  if (!(error instanceof Error)) return false;
  if (!isNotConnectionError(error)) return true;
  return (
    error.name === 'ReplyError' &&
    UNAVAILABLE_REPLIES.some((prefix) => error.message.startsWith(prefix))
  );
}
