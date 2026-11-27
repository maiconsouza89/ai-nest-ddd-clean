---
type: reference
---

# Outbox e filas

Os parâmetros da outbox transacional (`shared.outbox`), das filas de eventos do BullMQ e da marca de evento processado (`shared.processed_events`). O porquê está em [Entrega de eventos](../explanation/entrega-de-eventos.md), e as métricas em [Observabilidade](observabilidade.md).

O `OutboxModule` (`src/shared/infra/outbox/`, global) liga a outbox e a inbox: registra as duas entities, liga `Outbox`, `ProcessedEvents` e `IdempotentConsumer`, e roda o relay, o worker e as métricas da outbox. Exporta o `Outbox` e o `IdempotentConsumer`. O transporte vem do `MessagingModule` (`src/shared/infra/messaging/`), e as conexões com o Redis, do `RedisModule` (`src/shared/infra/redis/`): as filas enfileiram pelo `commands` da `QueueRedisConnection`, e os workers esperam jobs pelo `blocking`.

## Interruptores

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `OUTBOX_WORKER_ENABLED` | `true` | Liga o `OutboxWorker`: o laço do relay e a limpeza |
| `QUEUE_WORKERS_ENABLED` | `true` | Liga o `EventWorkers`: um worker do BullMQ por consumidor |

Os dois estão também em [Variáveis de ambiente](variaveis-de-ambiente.md).

## Relay da outbox

Os valores padrão ficam em `DEFAULT_OUTBOX_OPTIONS` (`src/shared/infra/outbox/outbox-relay.ts`), salvo indicação.

| Parâmetro | Valor | Onde | Efeito |
| --- | --- | --- | --- |
| Lote | 50 linhas | `batchSize` | Linhas buscadas, travadas e entregues por transação do relay |
| Espera entre buscas | 1 s | `POLL_INTERVAL_MS`, `outbox-worker.ts` | Só depois de um lote com menos de `batchSize` linhas. Lote cheio busca de novo na hora |
| Primeira espera após falha | 1 s | `baseDelayMs` | Espera depois da primeira falha de uma linha |
| Teto da espera | 5 min | `maxDelayMs` | Limite da espera entre tentativas |
| Falhas até morrer | 8 | `maxAttempts` | Na 8ª falha, a linha ganha `deadAt` e sai da busca. A falha de transporte não conta |
| Prazo do enfileiramento | 5 s | `ENQUEUE_TIMEOUT_MS`, `bullmq-publisher.ts` | Prazo de cada `add`. Estourado, conta como falha de transporte |
| Pausa com o transporte fora | 1 s a 30 s | `PAUSE_BASE_MS` e `PAUSE_MAX_MS`, `outbox-worker.ts` | Espera entre as rodadas da pausa, dobrando a cada rodada. Volta a 1 s na primeira rodada sem a falha |

- **Espera após a n-ésima falha:** `min(baseDelayMs × 2^(n − 1), maxDelayMs)` (`backoffDelayMs`, `outbox-relay.ts`). Com os padrões: 1 s, 2 s, 4 s, 8 s, 16 s, 32 s e 64 s depois das sete primeiras falhas. O teto de 5 min não é atingido com os padrões.
- **Busca** (`CLAIM_SQL`, `outbox-relay.ts`): linhas com `publishedAt` e `deadAt` nulos e `nextAttemptAt` vencido, sem linha anterior (`seq` menor) do mesmo `aggregateId` com `publishedAt` e `deadAt` nulos, em ordem de `seq`, com `FOR UPDATE OF o SKIP LOCKED`.
- **Sucesso:** a linha ganha `publishedAt`.
- **Falha:** a linha ganha `attempts + 1`, `lastError` e `nextAttemptAt`, e `deadAt` na última falha. Uma falha ao enfileirar em qualquer fila conta como falha da linha, menos a de transporte. As linhas mortas voltam à busca pelo [reprocesso](../how-to/reprocessar-eventos-mortos.md).
- **Falha de transporte:** o `publish` rejeita com `EventTransportUnavailableError` (`src/shared/application/ports/event-publisher.ts`) quando algum consumidor falhou por transporte. O `BullMqPublisher` decide por `isTransportFailure` (`src/shared/infra/messaging/transport-failure.ts`): o prazo de 5 s estourado, o `commands` da `QueueRedisConnection` fora de `ready`, um erro de conexão, ou uma resposta `READONLY`, `LOADING`, `MASTERDOWN` ou `OOM` do Redis. A `Queue` do consumidor que falhou é descartada e recriada no próximo publish.
- **Pausa:** na primeira falha de transporte do lote, o relay para de percorrer as linhas, não grava nada na linha que falhou (`attempts`, `nextAttemptAt` e `lastError` ficam como estavam), confirma as linhas já publicadas e rejeita. O `OutboxWorker` espera a pausa e tenta de novo. Logs: `warn` `outbox relay paused: event transport unavailable`, com o campo `error`, na entrada, e `info` `outbox relay resumed` na saída. As rodadas no meio da pausa não logam.

## Limpeza da outbox

| Parâmetro | Valor | Onde | Efeito |
| --- | --- | --- | --- |
| Intervalo | 1 h | `CLEANUP_INTERVAL_MS`, `outbox-worker.ts` | A primeira rodada acontece 1 h depois da subida |
| Retenção | 7 dias | `retentionMs`, `DEFAULT_OUTBOX_OPTIONS` | Apaga as linhas com `publishedAt` mais antigo que isso |
| Lote do `DELETE` | 10.000 linhas | `cleanupBatchSize`, `DEFAULT_OUTBOX_OPTIONS` | Repete o `DELETE` até um lote vir incompleto |

Nada apaga as linhas mortas (`deadAt`) da outbox nem as linhas de `shared.processed_events` ([Evoluções com gatilho](evolucoes-com-gatilho.md#infraestrutura-e-dados)). Para devolver as mortas à entrega: [Como reprocessar eventos mortos](../how-to/reprocessar-eventos-mortos.md).

## Tabela `shared.outbox`

| Coluna | Tipo | Conteúdo |
| --- | --- | --- |
| `id` | `uuid`, chave | O `eventId` do evento de integração |
| `seq` | `bigint`, sequência | Ordem de inserção. Define a ordem dos eventos de um agregado |
| `aggregateId` | `varchar` | Agregado que gerou o evento |
| `type` | `varchar` | Tipo do evento, por exemplo `orders.order-paid` |
| `version` | `int` | Versão do contrato do evento |
| `payload` | `jsonb` | Payload do evento |
| `metadata` | `jsonb`, padrão `{}` | Contexto técnico, como o `traceparent` |
| `occurredAt` | `timestamptz` | Hora do fato |
| `createdAt` | `timestamptz` | Hora da gravação |
| `publishedAt` | `timestamptz`, nulo | Hora em que o relay enfileirou o evento |
| `attempts` | `int`, padrão `0` | Falhas de entrega, sem contar as de transporte |
| `nextAttemptAt` | `timestamptz`, padrão `now()` | Hora a partir da qual a linha volta à busca |
| `deadAt` | `timestamptz`, nulo | Hora em que a linha passou do limite de falhas |
| `lastError` | `text`, nulo | Mensagem da última falha |

Índices parciais: `IDX_shared_outbox_pending` em `nextAttemptAt`, só com `publishedAt` e `deadAt` nulos, e `IDX_shared_outbox_dead` em `deadAt`, só com `deadAt` preenchido (`outbox-message.orm-entity.ts`).

## Filas de eventos

| Item | Formato | Onde |
| --- | --- | --- |
| Nome da fila | `events.<consumidor>` | `queueNameOf`, `src/shared/infra/messaging/event-subscriptions.ts` |
| Nome do job | O `type` do evento | `BullMqPublisher.publish`, `bullmq-publisher.ts` |
| `jobId` | `<eventId>__<consumidor>` (o BullMQ não aceita `:` no id) | `jobIdOf`, `bullmq-publisher.ts` |
| Dados do job | O evento de integração inteiro | `BullMqPublisher.publish` |

- **Fan-out:** o `BullMqPublisher` enfileira uma cópia em cada fila de consumidor que assina o `type`, com `Promise.allSettled`. Se algum consumidor falhou por transporte, lança `EventTransportUnavailableError`; senão, a primeira falha. Um evento sem assinante não enfileira nada.
- **Workers:** um `Worker` do BullMQ por consumidor (`event-workers.ts`), sem `concurrency` nas opções.

### Opções dos jobs

`QUEUE_JOB_OPTIONS`, em `src/shared/infra/messaging/bullmq-publisher.ts`:

| Parâmetro | Valor | Opção do BullMQ | Efeito |
| --- | --- | --- | --- |
| Tentativas | 10 | `attempts` | Contam a primeira execução. Esgotadas, o job vai para o conjunto `failed` da fila |
| Espera entre tentativas | exponencial a partir de 2 s | `backoff: { type: 'exponential', delay: 2_000 }` | 2 s, 4 s, 8 s... Cerca de 17 min até o job ir para `failed` |
| Retenção dos concluídos | 24 h | `removeOnComplete: { age: 24 * 3600 }` | Janela em que o `jobId` barra o job repetido |
| Retenção dos que falharam | 7 dias | `removeOnFail: { age: 7 * 24 * 3600 }` | Tempo em que o job fica no conjunto `failed`, a fila de mortos do consumidor |

## Consumidores

- **Declaração:** `@IntegrationEventHandler({ events, consumer })` num método de um provider (`integration-event-handler.decorator.ts`). Um método atende um consumidor, que pode assinar vários tipos de evento. A subida acha os métodos pelo `DiscoveryService` do Nest.
- **Nome:** `<módulo consumidor>.<efeito>`, único na aplicação. Um nome declarado por dois métodos derruba a subida com `Consumer "<nome>" is declared by more than one handler method`.
- **O mesmo nome no `IdempotentConsumer`:** o primeiro argumento de `IdempotentConsumer.handle` é igual ao `consumer` do decorator.
- **O nome não muda depois de publicado:** ele dá nome à fila (`events.<consumidor>`) e à marca em `shared.processed_events`.

## Tabela `shared.processed_events`

| Coluna | Tipo | Conteúdo |
| --- | --- | --- |
| `eventId` | `uuid`, chave | Id do evento tratado |
| `consumer` | `varchar`, chave | Nome do consumidor |
| `processedAt` | `timestamptz`, padrão `now()` | Hora da marca |

A chave primária é (`eventId`, `consumer`). O `tryMark` (`typeorm-processed-events.ts`) faz `INSERT ... ON CONFLICT DO NOTHING RETURNING` na transação ativa e devolve `true` só quando insere. O `IdempotentConsumer` (`src/shared/application/idempotent-consumer.ts`) chama o `tryMark` e o efeito na mesma transação, e pula o efeito quando a marca já existe.

## Filas dos jobs agendados

Cada job agendado tem uma fila própria, registrada pelo `ScheduledJobProcessor` (`src/shared/infra/jobs/scheduled-job.processor.ts`) só com `JOBS_ENABLED=true`. Como criar um: [Como agendar um job](../how-to/agendar-um-job.md).

| Parâmetro | Valor | Onde | Efeito |
| --- | --- | --- | --- |
| Concorrência | 1, global | `setGlobalConcurrency(1)` | Um job por vez em todas as instâncias: o próximo disparo não começa por cima de uma execução longa |
| Histórico dos concluídos | 20 execuções | `removeOnComplete: 20`, `upsertJobScheduler` | Últimas execuções concluídas guardadas pelo BullMQ |
| Histórico dos que falharam | 100 execuções | `removeOnFail: 100`, `upsertJobScheduler` | Últimas execuções com falha guardadas pelo BullMQ |
| Prazo do registro | 10 s | `REGISTER_TIMEOUT_MS` | Sem o registro do agendador, a subida falha com `<scheduler>: scheduler registration failed` |
| Falha em `run()` | Sem nova tentativa | `worker.on('failed')` | Log `error` `<scheduler> failed`. O próximo disparo do agendamento roda normalmente |
