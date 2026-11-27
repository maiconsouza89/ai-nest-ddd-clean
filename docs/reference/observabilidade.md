---
type: reference
---

# Observabilidade

As métricas que a app exporta, as próprias e as da auto-instrumentação, como cada coleta roda e alertas de exemplo. As variáveis `OTEL_*`, que escolhem o exporter e o intervalo, estão em [Variáveis de ambiente](variaveis-de-ambiente.md#opentelemetry). O porquê está em [Observabilidade](../explanation/observabilidade.md).

## Métricas próprias

| Métrica | Tipo | Unidade | Atributos | O que mede |
| --- | --- | --- | --- | --- |
| `outbox.events` | Gauge | `{event}` | `outbox.event.state`: `pending` ou `dead` | Eventos esperando publicação e eventos mortos (`deadAt`) |
| `outbox.oldest_pending.age` | Gauge | `s` | — | Idade do pendente mais antigo, `0` sem pendente |
| `bullmq.queue.jobs` | Gauge | `{job}` | `bullmq.queue.name`, `bullmq.queue.jobs.state`: `waiting`, `active`, `delayed` ou `failed` | Jobs por estado em cada fila `events.<consumidor>`. O `failed` é a fila de mortos do consumidor |
| `bullmq.jobs.retried` | Contador | `{job}` | `bullmq.queue.name`, `bullmq.job.name` (o tipo do evento) | Falhas no worker que vão ser tentadas de novo |
| `bullmq.jobs.failed` | Contador | `{job}` | `bullmq.queue.name`, `bullmq.job.name` | Jobs que esgotaram as tentativas e foram para o `failed` |

| Item | Valor |
| --- | --- |
| Classes | `OutboxMetrics` (`src/shared/infra/outbox/outbox-metrics.ts`), `QueueMetrics` (`src/shared/infra/messaging/queue-metrics.ts`) e os contadores do `EventWorkers` (`src/shared/infra/messaging/event-workers.ts`) |
| Meters | `outbox` e `messaging`, pedidos no `onApplicationBootstrap` |
| Instâncias que medem a outbox | `OUTBOX_WORKER_ENABLED=true` |
| Instâncias que medem as filas | `QUEUE_WORKERS_ENABLED=true` |
| Agregação entre instâncias | `max` nos gauges |
| Nomes das filas | Os do `MetricNames` e do `TelemetryAttributes` do BullMQ |
| Diferença para a telemetria do BullMQ | O BullMQ conta a nova tentativa com backoff como `bullmq.jobs.delayed`, e não como `bullmq.jobs.retried` |
| `bullmq.jobs.failed` | Conta só as falhas que o worker vê. Um job que vai para o `failed` por travar demais (`maxStalledCount`) aparece só no `bullmq.queue.jobs` |
| Fora das métricas | As filas dos jobs agendados (`ScheduledJobProcessor`) |
| Prefixo do serviço | Nenhum. O `service.name` vai no recurso |
| `service.instance.id` | Um por subida da app |
| Teste | `outbox-metrics.int-spec.ts` e `messaging.int-spec.ts` |

## Métricas da auto-instrumentação

| Origem | Métrica | Tipo | Atributos |
| --- | --- | --- | --- |
| HTTP | `http.server.request.duration` (s) | Histograma | `http.request.method`, `http.route`, `http.response.status_code` e, nas respostas 5xx, `error.type` |
| Pool do Postgres (`pg`) | `db.client.connection.count` | Contagem | `db.client.connection.state`: `used` ou `idle` |
| Pool do Postgres (`pg`) | `db.client.connection.pending_requests` | Contagem | Pedidos esperando uma conexão com o pool cheio |
| Pool do Postgres (`pg`) | `db.client.connection.max` | Contagem | O `DATABASE_POOL_MAX` |
| Pool do Postgres (`pg`) | `db.client.operation.duration` | Histograma | — |
| Runtime do Node | `nodejs.eventloop.*` | — | Atraso e uso do event loop |
| Runtime do Node | `v8js.*` | — | Heap e GC do V8 |

- **Requisições e erros de HTTP:** a contagem do histograma `http.server.request.duration`, filtrada pelo `http.response.status_code` ou pelo `error.type`.
- **`http.route`:** o molde da rota (`/v1/orders/:id`), e não a URL. Uma rota que não existe sai sem `http.route`.
- **Sondas de health:** `/health` e `/health/*` ficam fora das métricas de HTTP, pelo `ignoreIncomingRequestHook` (`isHealthRequest`, em `src/shared/infra/observability/ignored-paths.ts`).
- **Contadores do pool:** atualizados só nos eventos do pool (conexão aberta, emprestada, devolvida ou removida). Depois de uma devolução, `used` sai uma conexão acima do real e `idle` uma abaixo, porque o `pg-pool` avisa a devolução antes de pôr a conexão entre as ociosas.
- **`db.client.connection.pool.name`:** sai como `unknown_host:unknown_port/unknown_database`, porque a conexão vem da `DATABASE_URL`.
- **`fs`:** sem instrumentação (`@opentelemetry/instrumentation-fs` desligada no `tracing.ts`).

## Coleta

| Item | Valor |
| --- | --- |
| Intervalo | O da exportação do SDK: 60 s no padrão (`OTEL_METRIC_EXPORT_INTERVAL`) |
| Com `OTEL_METRICS_EXPORTER=none` | Meters noop, sem coleta |
| Consulta da outbox | Uma, com três subconsultas sobre `shared.outbox`, pelos índices parciais `IDX_shared_outbox_pending` e `IDX_shared_outbox_dead` |
| Consulta das filas | Um `getJobCounts` por fila de consumidor |
| Prazo | `withTimeout` de 5 s na consulta da outbox e em cada `getJobCounts` |
| Falha ou prazo estourado | Log `warn` e nenhum ponto observado na coleta. Com a temporalidade cumulativa, o SDK repete o último valor da série |
| Fila que falha | Só ela fica sem ponto na coleta. As outras são observadas |
| Remoção do callback | No `onModuleDestroy`, fase 1 do desligamento ([Operação](operacao.md#desligamento)) |

| Mensagem de log | Nível | Campos | Quando |
| --- | --- | --- | --- |
| `outbox metrics collection failed` | `warn` | `err` | A consulta da outbox falhou ou passou de 5 s |
| `queue metrics collection failed` | `warn` | `err`, `queue` | O `getJobCounts` de uma fila falhou ou passou de 5 s |

| Redis fora do ar | Coleta das filas |
| --- | --- |
| Caiu com a app no ar | Falha na hora: a conexão `commands` da `QueueRedisConnection` não tem fila offline |
| Já estava fora na subida | Espera a conexão e falha no prazo de 5 s |

## Alertas de exemplo

| Sinal | Métrica | Condição |
| --- | --- | --- |
| Erros de HTTP | `http.server.request.duration` | Taxa de respostas 5xx por `http.route` acima do normal |
| Outbox parada | `outbox.oldest_pending.age` | Acima de alguns minutos: o relay não está publicando, ou um evento está preso |
| Consumidor esgotando tentativas | `bullmq.queue.jobs` | `failed` crescendo numa fila |
| Eventos mortos | `outbox.events` | `outbox.event.state=dead` acima de 0. Uma queda do Redis não mata evento, então um morto indica defeito: o `lastError` da linha diz qual, e [Como reprocessar eventos mortos](../how-to/reprocessar-eventos-mortos.md) a devolve à entrega |
