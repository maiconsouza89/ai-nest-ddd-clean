# Plano das métricas com OpenTelemetry (#17)

A issue #17 pede métricas ao lado dos traces e dos logs, para montar alertas de taxa de erro, latência, fila parada e outbox atrasada. O exporter sai das variáveis padrão (`OTEL_METRICS_EXPORTER=otlp|prometheus|console|none`), como nos traces. Entram as métricas HTTP da auto-instrumentação e métricas próprias das filas do BullMQ, da outbox e do pool do Postgres. Pronto quando as métricas aparecem com `OTEL_METRICS_EXPORTER=console`, o `npm run ci` passa e o [Observabilidade](../explanation/observabilidade.md) e as [Variáveis de ambiente](../reference/variaveis-de-ambiente.md) estão atualizados.

**Mudanças em relação ao texto da issue:**

- **As métricas já estão ligadas no `NodeSDK`.** O `NodeSDK` 0.301.2 lê o `OTEL_METRICS_EXPORTER` no construtor (`getMetricReadersFromEnv`, em `node_modules/@opentelemetry/sdk-node/dist/utils.mjs`), aceita `otlp`, `prometheus`, `console` e `none`, e passa o `MeterProvider` a todas as instrumentações. Quem as desliga é o `none` do `.env.example`, do `Dockerfile` e do `docker-compose.yml`. O `tracing.ts` muda só nos comentários, e nenhum pacote entra em `dependencies`: o `@opentelemetry/exporter-prometheus` já vem com o `sdk-node`.
- **Uma métrica HTTP, e não três.** A `@opentelemetry/instrumentation-http` emite só o histograma `http.server.request.duration`, com `http.route`, `http.request.method`, `http.response.status_code` e `error.type` nas respostas 5xx. As requisições são a contagem do histograma, e os erros são o filtro por `error.type` ou pelo status. As sondas de health ficam de fora, pelo mesmo `ignoreIncomingRequestHook` dos spans.
- **O pool do Postgres vem da auto-instrumentação.** A `@opentelemetry/instrumentation-pg` 0.78.0 emite `db.client.connection.count` (`state` `used` e `idle`), `db.client.connection.pending_requests`, `db.client.connection.max` e `db.client.operation.duration`, lidos do `totalCount`, `idleCount` e `waitingCount` do `pg-pool`. Código próprio só entra se a conferência do passo 2 mostrar um número errado.
- **O `console` ignora o intervalo.** Com `console`, o `NodeSDK` monta o `PeriodicExportingMetricReader` sem ler o `OTEL_METRIC_EXPORT_INTERVAL`, e a exportação sai a cada 60 s. As métricas próprias saem do ar no desligamento (passo 5), então a conferência do "Pronto quando" espera pelo menos 60 s com a app no ar.
- **O CI não roda o `tracing.ts`.** Os testes não carregam o `main.ts`, e o `setup-env.ts` desliga o SDK. As métricas próprias têm teste de integração, com um `MeterProvider` de teste. A saída do `console` se confere à mão, como na #15.
- **Entra uma migration.** Contar as linhas mortas da outbox a cada coleta faria uma varredura da tabela inteira, que guarda 7 dias de eventos publicados. Um índice parcial em `"deadAt" IS NOT NULL` deixa a contagem barata.

Tudo entra em **um PR**, na branch `feat/metricas-opentelemetry`. O plano nasce e é apagado no mesmo PR, e o registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

## Decisões

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-25, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Métricas próprias | Três grupos. **Outbox:** eventos pendentes, eventos mortos e idade do pendente mais antigo. **Filas de eventos:** jobs por estado (`waiting`, `active`, `delayed`, `failed`) em cada fila `events.<consumidor>`, e um contador de falhas no worker, separando a falha que vai ser repetida da que esgota as tentativas. **Pool:** nenhuma, pela `instrumentation-pg`. O pendente da outbox não está na issue, mas sai da mesma consulta e diz se a outbox está atrasada por volume ou por um evento preso |
| Nomes das métricas | **Filas:** os nomes e atributos da telemetria do próprio BullMQ (`MetricNames` em `bullmq/dist/esm/enums/telemetry-attributes.d.ts`): `bullmq.queue.jobs`, com `bullmq.queue.name` e `bullmq.queue.jobs.state`, `bullmq.jobs.retried` e `bullmq.jobs.failed`. Um painel feito sobre eles continua valendo se o projeto passar ao `bullmq-otel`. **Outbox:** `outbox.events`, com `outbox.event.state` (`pending` ou `dead`), e `outbox.oldest_pending.age`, em `s`. Sem prefixo do serviço: o `service.name` já vai no recurso |
| Filas dos jobs agendados | Ficam de fora. Cada `ScheduledJobProcessor` cria a fila dele, e o `shared` não tem a lista. Um job que falha já loga `error`, e o próximo disparo é a nova tentativa ([Redis](../explanation/redis.md#jobs-agendados)). Medir essas filas pede um registro das filas no `shared`, e fica em Evoluções com gatilho |
| Onde as métricas próprias são coletadas | A outbox só nas instâncias com `OUTBOX_WORKER_ENABLED=true`, e as filas só nas com `QUEUE_WORKERS_ENABLED=true`. Uma instância só de HTTP não consulta o banco nem o Redis para isso. As instâncias com worker reportam o mesmo valor global, cada uma com o seu `service.instance.id`, e o painel agrega com `max`, nunca com `sum`. Uma variável própria para ligar a coleta seria mais um interruptor sem caso de uso |
| Intervalo de exportação | O padrão do SDK, 60 s, sem variável no `.env.example`. A página de variáveis documenta o `OTEL_METRIC_EXPORT_INTERVAL` e diz que o `console` não o lê. Cada coleta faz uma consulta à outbox e um `getJobCounts` por fila, e 60 s mantém esse custo desprezível |
| Exporter `prometheus` | Documentado e não montado. A página de variáveis cita o `OTEL_EXPORTER_PROMETHEUS_HOST` e o `OTEL_EXPORTER_PROMETHEUS_PORT` e três cuidados: o servidor sobe em `localhost:9464`, inalcançável de fora do container sem `OTEL_EXPORTER_PROMETHEUS_HOST=0.0.0.0`; o `/metrics` não tem autenticação; e dois worktrees com `prometheus` disputam a porta. Nada muda no `Dockerfile` (sem `EXPOSE`) nem no `docker-compose.yml` |
| Métricas de runtime | Ficam ligadas. A `instrumentation-runtime-node` vem ligada no `getNodeAutoInstrumentations` e emite atraso e uso do event loop, heap e GC (`nodejs.eventloop.*`, `v8js.*`), com baixa cardinalidade. Com o `OTEL_METRICS_EXPORTER` ligado elas saem junto. Desligar seria uma linha no `tracing.ts`, como a do `fs` |
| Teste automático do `tracing.ts` | Nenhum, como na #15. Subir a app compilada com o SDK ligado e ler o `console` no CI pediria um job novo, com o stack inteiro, para conferir a configuração do SDK. A conferência fica manual (passo 2 e passo 8) |
| Padrão do `OTEL_METRICS_EXPORTER` | Continua `none` no `.env.example`, no `Dockerfile` e no `docker-compose.yml`. Sem coletor, o padrão do SDK (`otlp`) atrasa o desligamento em uns 8 s ([Operação](../reference/operacao.md#desligamento)). Quem tem coletor define `otlp` no ambiente, como já faz com os traces |
| API usada nas métricas próprias | A global do `@opentelemetry/api` (`metrics.getMeter(...)`), já em `dependencies`, como o `trace.getTracer('outbox')` do `trace-context.ts`. O meter é pedido dentro do hook de ciclo de vida, e nunca no topo do arquivo: a API de métricas não tem proxy (`getMeterProvider()` devolve o `NOOP_METER_PROVIDER` enquanto nada se registra), e um meter pedido antes do `MeterProvider` fica noop para sempre. Os escopos são `outbox` e `messaging` |
| Onde fica o código | No `shared/infra`, ao lado do que medem: `src/shared/infra/outbox/outbox-metrics.ts` no `OutboxModule`, `src/shared/infra/messaging/queue-metrics.ts` no `MessagingModule` e o contador de falhas no `event-workers.ts`. São classes `@Injectable()` que recebem por construtor só classes (`DataSource`, `BullMqConnection`, `EventSubscriptions`, `Logger`, `ConfigService`), sem token para o `Meter`. Nada entra na application nem nos módulos, e o `npm run arch` não muda. O `tracing.ts` não importa nada disso |
| Instrumentos | Gauges observáveis (`createObservableGauge`) com um `addBatchObservableCallback` por classe: uma consulta alimenta todos os instrumentos dela. Gauge, e não `UpDownCounter`, porque o valor é global e várias instâncias o reportam: somar não tem sentido. As falhas do worker são `Counter` síncrono |
| Custo e falha na coleta | Com o `none`, o meter é noop e os callbacks nunca rodam. Ligado, cada callback roda dentro de um `withTimeout` de 5 s (`src/shared/infra/resilience/with-timeout.ts`). Se falhar, loga `warn` e não observa nada: a série fica com um buraco, e não com um valor velho. O Redis fora do ar falha na hora, porque o `producer` não tem fila offline |
| Desligamento | Cada classe tira o callback (`removeBatchObservableCallback`) no `onModuleDestroy`, a fase 1. O `TracingShutdown` faz a última exportação na fase 4, com o `DataSource` e o Redis já fechados: sem isso, o callback falharia no fim de todo desligamento |
| Consulta da outbox | Uma só, com três subconsultas. O pendente segue o predicado do índice parcial que já existe (`"publishedAt" IS NULL AND "deadAt" IS NULL`). A idade sai do `createdAt` contra o `now()` do banco, os dois no relógio do Postgres, e é `0` sem pendente, para o alerta não ver um buraco. Os mortos usam o índice novo `IDX_shared_outbox_dead`, parcial em `"deadAt" IS NOT NULL`, pequeno porque as linhas mortas são raras |
| Consulta das filas | Uma `Queue` por consumidor de `EventSubscriptions.all()`, sobre o `BullMqConnection.producer`, fechada no desligamento. `getJobCounts('waiting', 'active', 'delayed', 'failed')`. O `failed` é a fila de mortos de cada consumidor, guardada por 7 dias (`removeOnFail`). O `recordJobCountsMetric()` do BullMQ não serve: só grava se a fila tiver o `telemetry` do `bullmq-otel` |
| `bullmq-otel` | Fica de fora. O `telemetry` do BullMQ pede `tracer` e `contextManager`, além do `meter`, e abriria spans próprios do BullMQ ao lado do `runInEventTrace`, com outra propagação do contexto. Os nomes iguais aos dele deixam a troca possível depois |
| Cardinalidade | `http.route` é o molde da rota do Express (`/v1/orders/:id`), não a URL. Os atributos das métricas próprias são o nome da fila e o estado, que são poucos. O passo 2 confere o `http.route` de uma rota que não existe. O `service.instance.id` muda a cada subida e cria séries novas no backend: é o padrão do SDK e fica documentado |
| ADR | Não entra. A escolha cabe no `observabilidade.md` e não muda uma decisão registrada |
| Tipo do commit e do PR | `feat(observabilidade)`: métricas novas para quem opera. Sem `!`: com o padrão `none`, nada muda para quem não liga o exporter |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Métricas das filas dos jobs agendados | Linha em Evoluções com gatilho (passo 7): um registro das filas no `shared`, que o `ScheduledJobProcessor` preenche. Gatilho: um job agendado parar sem que o log de erro bastasse para perceber |
| Métricas de negócio (pedidos pagos, logins recusados) | Nenhum por enquanto. Pediriam um port na application, porque a application não importa o OpenTelemetry. Gatilho: um alerta de negócio que o log não sirva para montar. Linha em Evoluções com gatilho |
| Trocar a coleta das filas pelo `bullmq-otel` | Linha em Evoluções com gatilho: quando o projeto quiser os spans do BullMQ, ou quando o `bullmq-otel` aceitar só o `meter` |
| Alertas e painéis prontos | Ficam com quem opera. O `observabilidade.md` dá três exemplos de alerta em palavras (taxa de 5xx por rota, outbox com pendente velho, fila com `failed` crescendo), sem PromQL |
| Porta do Prometheus por worktree no `worktree:setup` | Nenhum. O padrão é `none`, e quem liga o `prometheus` num worktree define a porta |
| Limpeza das linhas mortas da outbox | Já está em Evoluções com gatilho. A métrica de mortos ajuda a ver o gatilho |

## Referências

- Issue #17: `gh issue view 17`.
- Versões instaladas e latest em 2026-11-25 (`npm view`), iguais: `@opentelemetry/sdk-node` 0.301.2, `@opentelemetry/sdk-metrics` 3.1.1, `@opentelemetry/exporter-prometheus` 0.301.2 (dependência do `sdk-node`), `@opentelemetry/api` 1.10.0, `@opentelemetry/auto-instrumentations-node` 0.83.1, `@opentelemetry/instrumentation-http` 0.301.2, `@opentelemetry/instrumentation-pg` 0.78.0, `@opentelemetry/instrumentation-runtime-node` 0.38.0, `bullmq` 6.7.10 e `pg` 8.23.1 (`pg-pool` 3.14.0). O `bullmq-otel` está em 2.0.1 e fica de fora. Na execução, confira de novo.
- OpenTelemetry JS, consultado no Context7 em 2026-11-25 (`/open-telemetry/opentelemetry-js`):
  - README do `sdk-node`: `OTEL_METRICS_EXPORTER` aceita `otlp`, `prometheus`, `console` e `none`, com `otlp` como padrão; `OTEL_METRIC_EXPORT_INTERVAL` (60000) e `OTEL_METRIC_EXPORT_TIMEOUT` (30000) valem para o reader de push.
  - `sdk-node/src/utils.ts` e o changelog 3.0.0 do exporter: o `sdk-node` passa o `OTEL_EXPORTER_PROMETHEUS_HOST` e o `_PORT` ao `PrometheusExporter`, que sobe em `localhost:9464`, no `/metrics`, e não lê mais as variáveis sozinho.
  - README do `sdk-metrics`: `createObservableGauge`, `addCallback` e `addBatchObservableCallback` (um callback para vários instrumentos); `InMemoryMetricExporter` e `MetricReader.collect()` para testes.
  - README da `instrumentation-http`: emite `http.server.request.duration` e `http.client.request.duration`.
- OpenTelemetry JS Contrib, consultado no Context7 em 2026-11-25 (`/open-telemetry/opentelemetry-js-contrib`): o README da `instrumentation-pg` lista `db.client.operation.duration`, `db.client.connection.count`, `db.client.connection.max` e `db.client.connection.pending_requests`, e instrumenta o `pg.Pool` junto com o `pg`.
- BullMQ, consultado no Context7 em 2026-11-25 (`/taskforcesh/bullmq`, `docs/gitbook/guide/telemetry/metrics.md`): o gauge `bullmq.queue.jobs` só é gravado pelo `recordJobCountsMetric()`, com o `telemetry` do `bullmq-otel`. O `getJobCounts(...types)` e os nomes das métricas foram conferidos no código instalado (`dist/esm/classes/queue-getters.d.ts` e `dist/esm/enums/telemetry-attributes.d.ts`).
- node-postgres, consultado no Context7 em 2026-11-25 (`/brianc/node-postgres`, `docs/pages/apis/pool.mdx`): `totalCount`, `idleCount` e `waitingCount`, e os eventos `connect`, `acquire`, `release` e `remove`.
- Código instalado, lido porque a documentação não diz:
  - `@opentelemetry/sdk-node/dist/utils.mjs`: com `console`, o reader sai sem `exportIntervalMillis`, e vale o padrão de 60 s do `PeriodicExportingMetricReader`; `none` na lista desliga tudo.
  - `@opentelemetry/sdk-node/dist/sdk.mjs`: o `MeterProvider` só existe com algum reader, e o `setMeterProvider` chega a todas as instrumentações.
  - `@opentelemetry/api/dist/api/metrics.mjs`: `getMeterProvider()` devolve o noop sem proxy.
  - `@opentelemetry/instrumentation-http/dist/http.mjs` e `utils.mjs`: os atributos do histograma, e o request ignorado pelo `ignoreIncomingRequestHook` não gera métrica.
  - `@opentelemetry/instrumentation-express/dist/instrumentation.mjs`: o `http.route` vai para o metadata do HTTP antes da checagem do span, então vale com `OTEL_TRACES_EXPORTER=none`.
  - `@opentelemetry/instrumentation-pg/dist/utils.mjs`: os contadores do pool só se atualizam nos eventos do pool, e o nome do pool é `host:porta/banco`.
- Código do projeto: `src/tracing.ts`, `src/shared/infra/outbox/` (`outbox-relay.ts`, `outbox-worker.ts`, `outbox-message.orm-entity.ts`, `outbox.module.ts`), `src/shared/infra/messaging/` (`bullmq-connection.ts`, `bullmq-publisher.ts`, `event-subscriptions.ts`, `event-workers.ts`, `messaging.module.ts`, `messaging.int-spec.ts`), `src/shared/infra/resilience/with-timeout.ts`, `src/shared/infra/observability/trace-context.spec.ts` (modelo de teste com provider global), `test/helpers/outbox-database.ts`, `.env.example`, `Dockerfile`, `docker-compose.yml`.
- Páginas a mudar:
  - `docs/explanation/observabilidade.md` (linhas 7 e 27, e seções novas);
  - `docs/reference/variaveis-de-ambiente.md` (seção "Tracing (OpenTelemetry)");
  - `docs/reference/operacao.md` (tabela e parágrafo do desligamento);
  - `docs/how-to/fazer-o-deploy.md` (linha 33);
  - `docs/explanation/consistencia-e-eventos.md` (falhas da outbox e filas de mortos);
  - `docs/reference/evolucoes-com-gatilho.md`;
  - `docs/README.md` (resumo do Observabilidade) e a rota do tracing no `AGENTS.md`.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): o `tracing.ts` e o `observabilidade.md` são da mesma trilha, e a #15 já entrou. O `package.json` e o `package-lock.json` mudam em várias: faça rebase sobre a `main` antes do PR e refaça o lockfile com `npm install`.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal: data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR e comentário na issue só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Conferência do que a auto-instrumentação já emite | ⬜ |
| 3 | Comentários do `tracing.ts`, do `.env.example`, do `Dockerfile` e do compose | ⬜ |
| 4 | Índice parcial das linhas mortas da outbox | ⬜ |
| 5 | Métricas da outbox | ⬜ |
| 6 | Métricas das filas de eventos | ⬜ |
| 7 | Documentação | ⬜ |
| 8 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha C com a branch `feat/metricas-opentelemetry` e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Traga este plano para a branch.
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #17 como 🟡.
4. Commit: `docs(plan): plano das métricas com OpenTelemetry (#17)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: o que a auto-instrumentação já emite

Sem mudar código. O resultado decide o pool e entra na descrição do PR.

1. `npm run build`, `npm run db:setup` e `npm run db:seed`. Suba a app com `OTEL_METRICS_EXPORTER=console node dist/main.js`, com o `start:dev` deste checkout parado.
2. Faça um `POST /v1/auth/login`, um `GET /v1/orders/<uuid qualquer>` autenticado, um `GET /nao-existe` e um `GET /health/ready`. Espere pelo menos 60 s pela exportação.
3. Anote na saída:
   - `http.server.request.duration`: o `http.route` de cada requisição. O `/v1/orders/:id` tem que sair como molde, e o `/nao-existe` sem `http.route` ou com um valor fixo. O `/health/ready` não aparece. O 401 ou 404 sai sem `error.type`, e um 5xx sairia com ele.
   - `db.client.connection.count`, `db.client.connection.max` (igual ao `DATABASE_POOL_MAX`) e `db.client.connection.pending_requests`, com o `db.client.connection.pool.name` em `host:porta/banco`, e não em `unknown_host`.
   - `nodejs.eventloop.*`, `v8js.*` e qualquer outra métrica que aparecer, para a lista do `observabilidade.md`.
4. Confira o `pending_requests` com o pool cheio: com `DATABASE_POOL_MAX=1`, dispare várias requisições ao mesmo tempo (por exemplo, 20 `curl` em paralelo no login) e veja se o valor sobe e volta a 0. Os contadores da `instrumentation-pg` só se atualizam nos eventos do pool, e um pedido que desiste pelo `DATABASE_CONNECT_TIMEOUT_MS` pode deixar o valor parado. Se ficar parado, pare e leve ao dono: a saída é um gauge próprio que lê o `waitingCount` do pool do `DataSource`, no `DatabaseModule`.
5. Rode o `EXPLAIN` das duas condições da outbox no banco do checkout e guarde o plano para comparar no passo 4: `SELECT count(*), min("createdAt") FROM shared.outbox WHERE "publishedAt" IS NULL AND "deadAt" IS NULL` e `SELECT count(*) FROM shared.outbox WHERE "deadAt" IS NOT NULL`.
6. Sem commit.

### Passo 3: comentários e configuração

1. `src/tracing.ts`: o comentário do topo cita o `OTEL_METRICS_EXPORTER=otlp|prometheus|console|none` ao lado do `OTEL_TRACES_EXPORTER`. Nada mais muda no arquivo, e nenhum import entra nele.
2. `.env.example`: o comentário do `OTEL_METRICS_EXPORTER` diz `otlp | prometheus | console | none`, que `none` é o padrão sem coletor e que o `console` imprime a cada 60 s.
3. `Dockerfile` e `docker-compose.yml`: os comentários deixam de dizer que o projeto não usa métricas, se disserem, e o `none` continua.
4. `npm run typecheck` e `npm run lint`.
5. Commit: `docs(observabilidade): comentários do exporter de métricas no tracing e nas variáveis de exemplo (#17)`.

### Passo 4: índice das linhas mortas da outbox

1. Em `src/shared/infra/outbox/outbox-message.orm-entity.ts`, um `@Index('IDX_shared_outbox_dead', ['deadAt'], { where: '"deadAt" IS NOT NULL' })`, com um comentário: a contagem das linhas mortas na coleta das métricas.
2. `npm run mig:outbox:gen` e renomeie a migration gerada para um nome que diga o que faz ([Como gerar uma migration](../how-to/gerar-uma-migration.md)). Confira que ela só cria o índice. Num banco de produção grande, um `CREATE INDEX` trava as escritas na outbox: o índice é pequeno, mas a varredura da tabela não. Avalie o `CREATE INDEX CONCURRENTLY`, que pede a migration fora da transação (`transaction = false` na classe), e registre a escolha na descrição do PR.
3. Acrescente a migration à lista do `test/helpers/outbox-database.ts`.
4. `npm run mig:outbox:run` no banco do checkout e o mesmo `EXPLAIN` do passo 2: a contagem de mortos passa a usar o índice.
5. `npm run test:int -- outbox`.
6. Commit: `feat(outbox): índice parcial das linhas mortas (#17)`.

### Passo 5: métricas da outbox

1. `src/shared/infra/outbox/outbox-metrics.ts`, `@Injectable()`, com `DataSource`, `Logger` e `ConfigService<EnvironmentVariables, true>` no construtor:
   - `onApplicationBootstrap`: com `OUTBOX_WORKER_ENABLED` diferente de `'true'`, não faz nada. Senão, pede `metrics.getMeter('outbox')`, cria os gauges `outbox.events` (`{event}`) e `outbox.oldest_pending.age` (`s`) e registra um `addBatchObservableCallback`.
   - O callback roda a consulta dentro de `withTimeout(..., 5_000)` e observa `outbox.events` com `outbox.event.state` `pending` e `dead`, e a idade, `0` sem pendente. Numa falha, `logger.warn({ err }, 'outbox metrics collection failed')` e nada observado.
   - A consulta, uma só: `SELECT (SELECT count(*) ... pendente) AS pending, (SELECT EXTRACT(EPOCH FROM now() - min("createdAt")) ... pendente) AS "oldestAge", (SELECT count(*) ... "deadAt" IS NOT NULL) AS dead`. O `count(*)` volta como texto do `pg`: converta com `Number`.
   - `onModuleDestroy`: `removeBatchObservableCallback` com o mesmo callback e os mesmos instrumentos.
   - Comente no código por que o meter é pedido no hook e por que o callback sai na fase 1.
2. Registre a classe nos `providers` do `OutboxModule`.
3. Acrescente `@opentelemetry/sdk-metrics` em `devDependencies`, na latest com `^`, como o `@opentelemetry/sdk-trace`: `npm install --save-dev @opentelemetry/sdk-metrics@latest`. Confira com `npm ls @opentelemetry/sdk-metrics` que fica uma cópia só.
4. `test/helpers/metrics.ts`: um helper que liga um `MeterProvider` global com um reader de teste (`metrics.setGlobalMeterProvider`) e devolve uma função que coleta (`reader.collect()`) e acha os pontos de uma métrica pelo nome. Explique no topo do arquivo que o provider tem que estar ligado antes do `app.init()`, e que o `afterAll` chama `metrics.disable()`.
5. `src/shared/infra/outbox/outbox-metrics.int-spec.ts`, com o `startOutboxDatabase` e um `TestingModule` mínimo:
   - sem linhas, `pending` e `dead` em 0 e a idade em 0;
   - com um evento pendente gravado há 2 minutos (`createdAt` no passado), `pending` 1 e a idade perto de 120;
   - com um evento morto, `dead` 1 e ele não conta como pendente;
   - com `OUTBOX_WORKER_ENABLED=false`, a coleta não traz `outbox.events`;
   - depois do `app.close()`, a coleta não chama mais a consulta.
6. `npm run typecheck`, `npm run lint`, `npm run arch` e `npm run test:int -- outbox-metrics`.
7. Commit: `feat(outbox): métricas de pendentes, mortos e idade do pendente mais antigo (#17)`.

### Passo 6: métricas das filas de eventos

1. `src/shared/infra/messaging/queue-metrics.ts`, `@Injectable()`, com `EventSubscriptions`, `BullMqConnection`, `Logger` e `ConfigService` no construtor:
   - `onApplicationBootstrap`: com `QUEUE_WORKERS_ENABLED` diferente de `'true'`, não faz nada. Senão, cria uma `Queue` por consumidor de `subscriptions.all()`, sobre o `connection.producer`, com o listener de `error` que o `BullMqPublisher` usa, e registra o gauge `bullmq.queue.jobs` (`{job}`) com um `addBatchObservableCallback`.
   - O callback chama `getJobCounts('waiting', 'active', 'delayed', 'failed')` em todas as filas, com `Promise.allSettled` e dentro do `withTimeout` de 5 s. Uma fila que falha não esconde as outras: loga `warn` e fica sem ponto.
   - `onModuleDestroy`: tira o callback e fecha as `Queue` criadas aqui.
   - Não dependa da ordem dos hooks entre o `EventSubscriptions` e esta classe: o `subscriptions.all()` varre os providers se a varredura ainda não aconteceu.
2. Registre a classe nos `providers` do `MessagingModule`.
3. `src/shared/infra/messaging/event-workers.ts`: no `onApplicationBootstrap`, com os workers ligados, peça `metrics.getMeter('messaging')` e crie os contadores `bullmq.jobs.retried` e `bullmq.jobs.failed` (`{job}`). No `worker.on('failed')`, some 1 no `failed` quando `exhausted`, e no `retried` nos outros casos, com `bullmq.queue.name` e `bullmq.job.name` (o tipo do evento).
4. Em `src/shared/infra/messaging/messaging.int-spec.ts`, ligue o provider de teste antes do `app.init()` e acrescente:
   - o `AlwaysFailsHandler` gera pontos em `bullmq.jobs.retried` na fila `events.test.always-fails`;
   - o `bullmq.queue.jobs` traz as duas filas do teste, com os quatro estados.

   Se o `messaging.int-spec.ts` ficar confuso, um arquivo próprio (`queue-metrics.int-spec.ts`) com o mesmo `startRedis`.
5. `npm run typecheck`, `npm run lint`, `npm run arch` e `npm run test:int -- messaging`.
6. Commit: `feat(messaging): métricas de jobs por estado e de falhas das filas de eventos (#17)`.

### Passo 7: documentação

1. `docs/explanation/observabilidade.md`:
   - A abertura (linha 7) cita as métricas, e a linha 27 deixa de dizer que o projeto não usa métricas: o exporter de logs continua sem uso, e o de métricas é escolhido pelo ambiente.
   - Seção nova "Métricas": o que vem da auto-instrumentação (o histograma HTTP, como ler requisições e erros dele, o pool pela `instrumentation-pg` e o runtime) e o que é próprio (outbox e filas), com a tabela de nomes, unidades e atributos.
   - Por que gauge e `max` entre instâncias, por que a coleta só roda nas instâncias com worker, o custo de cada coleta e o `withTimeout`, e o callback que sai na fase 1 do desligamento.
   - Três alertas de exemplo, em palavras: taxa de 5xx por `http.route`, `outbox.oldest_pending.age` acima de alguns minutos e `bullmq.queue.jobs` em `failed` crescendo.
   - Em "O que fica de fora": as filas dos jobs agendados e as métricas de negócio. Em "Alternativas e trade-offs": o `bullmq-otel`, um `UpDownCounter` somado entre instâncias e um gauge próprio do pool.
2. `docs/reference/variaveis-de-ambiente.md`, seção "Tracing (OpenTelemetry)":
   - O título passa a "OpenTelemetry". Atualize as âncoras `#tracing-opentelemetry` no `observabilidade.md`, no `operacao.md` e no `fazer-o-deploy.md`.
   - Linha do `OTEL_METRICS_EXPORTER`: `otlp`, `prometheus`, `console` e `none`, o que cada um faz e que o projeto mede HTTP, pool, runtime, outbox e filas.
   - Linhas novas: `OTEL_METRIC_EXPORT_INTERVAL` (60000, não vale para o `console`), `OTEL_EXPORTER_PROMETHEUS_HOST` e `OTEL_EXPORTER_PROMETHEUS_PORT`, com os cuidados da tabela de decisões.
   - Conserte a tabela: o parágrafo "A imagem Docker define..." está no meio dela, e as linhas do `OTEL_SERVICE_NAME` e do `OTEL_SDK_DISABLED` saem como texto. O parágrafo vai para depois da tabela.
3. `docs/reference/operacao.md`: na tabela do desligamento, a fase 1 lista as métricas da outbox e das filas (tiram o callback), e o `TracingShutdown` "espera o SDK exportar os spans e as métricas pendentes". O parágrafo da linha 139 continua certo: confira o texto.
4. `docs/how-to/fazer-o-deploy.md`, linha 33: `OTEL_METRICS_EXPORTER=otlp` para mandar as métricas ao mesmo coletor.
5. `docs/explanation/consistencia-e-eventos.md`: nos bullets de falhas da outbox e das duas filas de mortos, uma frase com a métrica de cada uma e o link para o `observabilidade.md`.
6. `docs/reference/evolucoes-com-gatilho.md`: as linhas de [Fora do plano](#fora-do-plano) (filas dos jobs agendados, métricas de negócio e `bullmq-otel`), com o contexto apontando para [Observabilidade](../explanation/observabilidade.md).
7. `docs/README.md`: o resumo do Observabilidade cita as métricas. No `AGENTS.md`, a rota "Mexer no tracing, no `main.ts` ou no `tracing.ts`" passa a "Mexer no tracing, nas métricas, no `main.ts` ou no `tracing.ts`".
8. `npm run docs:check`.
9. Commit: `docs(observabilidade): métricas do OpenTelemetry (#17)`.

### Passo 8: verificação, revisão, registro e PR

1. `npm run ci`. A mudança toca banco, Redis e filas: rode também `npm run test:int` e, com o `start:dev` deste checkout parado, `npm run test:e2e`.
2. Conferência manual do "Pronto quando", com `npm run build` e `npm run mig:outbox:run`:
   - `OTEL_METRICS_EXPORTER=console node dist/main.js`, as mesmas requisições do passo 2 e um pedido pago (para passar evento pela outbox e pela fila). Depois de 60 s, aparecem as métricas do passo 2, o `outbox.events`, o `outbox.oldest_pending.age` e o `bullmq.queue.jobs` de cada consumidor.
   - Com `OUTBOX_WORKER_ENABLED=false` e `QUEUE_WORKERS_ENABLED=false`, as métricas próprias somem e as HTTP continuam.
   - Com `OTEL_METRICS_EXPORTER=none`, nada aparece, e o desligamento não ganha atraso.
   - O `SIGTERM` com `console` termina sem `outbox metrics collection failed` no log.
   - Opcional: `OTEL_METRICS_EXPORTER=prometheus` e `curl localhost:9464/metrics`.
3. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar código, repita o passo 1 e a conferência do item 2.
4. Faça rebase sobre a `main`, refaça o lockfile com `npm install` se houver conflito nele e rode `npm run ci` de novo.
5. Com o ok do dono, faça push e abra o PR com o título `feat(observabilidade): métricas com OpenTelemetry de HTTP, filas, outbox e pool (#17)`. A descrição traz:
   - as mudanças em relação à issue: métricas já ligadas pelo ambiente, uma métrica HTTP, o pool pela auto-instrumentação, o `console` a cada 60 s, o CI que não roda o `tracing.ts` e a migration;
   - a tabela de métricas, com nome, origem, unidade e atributos;
   - a saída do `console` do item 2, resumida;
   - a escolha do `CREATE INDEX` do passo 4.
6. Com o ok do dono, deixe na issue um comentário de registro com este plano e os mesmos pontos da descrição.
7. Último commit da branch, `docs(plan): fecha o plano das métricas com OpenTelemetry (#17)`:
   - apague este plano;
   - no roadmap, marque a #17 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #17, como os das issues #19 e #15;
   - rode `npm run docs:check` de novo e faça push.
