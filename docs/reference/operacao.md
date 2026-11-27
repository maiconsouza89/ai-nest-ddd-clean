---
type: reference
---

# Operação

O que a app liga na subida e no desligamento: a configuração HTTP, o Swagger, o health check, o rate limit, os logs de acesso, o comportamento com o Redis fora do ar e a ordem de desligamento. As variáveis que mudam cada item estão em [Variáveis de ambiente](variaveis-de-ambiente.md), e os endereços com a app no ar em [Como preparar o ambiente local](../how-to/preparar-o-ambiente-local.md).

## Configuração HTTP

O `configureApp` (`src/app.setup.ts`) liga estes itens, na subida e nos testes e2e.

| Item | Configuração | Efeito |
| --- | --- | --- |
| `trust proxy` | `TRUST_PROXY` | Quantos proxies na frente da API são confiáveis. Define o IP que o rate limit conta. Com `0` e `NODE_ENV=production`, a subida avisa no log |
| Headers de segurança | `helmet()`, com as opções padrão | Em toda resposta |
| CORS | `enableCors({ origin })`, com as origens de `CORS_ORIGINS` | Vazio não liga o CORS |
| Versão na URL | `VersioningType.URI`, `defaultVersion: '1'` | Rotas em `/v1/...` ([Convenções](convencoes.md#versionamento-da-api-http)) |
| Validação da entrada | `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted`, `transform` e `errorFormat: 'grouped'` | Campo fora do DTO responde 400 `VALIDATION_FAILED`, com um item em `errors` por mensagem. Query e parâmetros chegam convertidos para o tipo do DTO |
| Respostas de erro | `ProblemDetailsFilter` global (`APP_FILTER` no `ProblemDetailsModule`) | Todo erro sai em Problem Details, com `code` e o `traceId` do span ativo ([Respostas de erro](respostas-de-erro.md)) |
| Desligamento | `enableShutdownHooks()` | Ver [Desligamento](#desligamento) |

## Swagger

| Item | Valor |
| --- | --- |
| Interface | `/docs`. O documento em `/docs-json` e `/docs-yaml` |
| Quando existe | Fora de `NODE_ENV=production` (`src/bootstrap.ts`) |
| Montagem | `createSwaggerDocument` (`src/shared/infra/http/swagger.setup.ts`) monta o documento, com `addBearerAuth()`. O `setupSwagger` o chama e serve o `/docs`. O `/docs-json` e o `openapi.json` saem da mesma configuração |
| Documento guardado | `openapi.json` na raiz, gerado pelo `src/openapi.ts` a partir do `dist/` (`npm run openapi:generate`). Sobe o `AppModule` no modo preview do Nest, que monta o grafo de módulos sem chamar construtor nem hook de provider: nada conecta no Postgres nem no Redis. As variáveis obrigatórias que faltam vêm do `.env.example`. As chaves de `paths` e de `components.schemas` saem em ordem alfabética. O `npm run openapi:check` confere que o arquivo está atualizado, e o CI compara o do PR com o da base ([Comandos → CI](comandos.md#ci)). O gerador falha, com a lista, se uma operação não tem resposta 2xx ou se um 200 ou 201 não descreve o corpo (`findUndocumentedSuccessResponses`, em `src/shared/infra/http/undocumented-success-responses.ts`) |
| Respostas de sucesso | Toda rota com corpo documenta o schema com uma classe `*.response.ts` ou `*.responses.ts` e o decorator explícito: `@ApiOkResponse({ type })`, `@ApiCreatedResponse({ type })` ou, numa listagem, `@ApiPageResponse(Item)`. O `ApiPageResponse` (`src/shared/infra/http/page.response.ts`) monta um `allOf` do `PageResponse` (`total`, `page` e `limit`) com os `items` do modelo. A convenção da classe está em [Camadas → Infra](camadas.md#infra) |
| Resposta pelo tipo de retorno | Não serve sozinha. O plugin só gera a resposta de sucesso quando a rota não tem decorator de sucesso, e trata como de sucesso todo `Api<X>Response` cujo `<X>` não é um status do `HttpStatus`: o `@ApiProblemResponse` desliga a inferência. Um tipo genérico, como o `Page<T>`, também sai como `{ "type": "object" }` |
| `/health/live` | O schema `TerminusHealthCheckResult`, que o `@HealthCheck()` do ready registra |
| Tags | Uma por controller: `auth`, `orders`, `products`, `health` |
| Rotas com token | `@ApiBearerAuth()` no controller (`orders`, `products`) |
| Respostas de erro | Schema `ProblemDetailsResponse`, em `application/problem+json`. Cada rota documenta os próprios erros com `@ApiProblemResponse(status, descrição)`, e o `setupSwagger` acrescenta o 429 e o 500 em toda operação |
| Teste | `test/docs.e2e-spec.ts`: `/docs` responde 200 sem token, toda rota tem exatamente uma tag, e as do auth e do health caem na tag certa. O schema de erro existe, e toda operação documenta o 429 e o 500 com ele. A resposta de sucesso não é conferida aqui: sem o plugin, os testes não veem as propriedades, e quem confere é o gerador (`findUndocumentedSuccessResponses`, com spec) |

O plugin da CLI do Nest (`nest-cli.json`) gera os schemas dos DTOs de requisição e de resposta.

| Opção | Valor | Efeito |
| --- | --- | --- |
| `dtoFileNameSuffix` | `.request.ts`, `.requests.ts`, `.query.ts`, `.response.ts`, `.responses.ts` | Arquivos lidos como DTO. O padrão do plugin é `.dto.ts` e `.entity.ts`, que o projeto não usa |
| `classValidatorShim` | `true` | Os decorators do `class-validator` viram regras no schema (`minLength`, `maximum`) |
| `introspectComments` | `true` | O comentário `/** */` da rota vira o resumo, e o da propriedade, a descrição |

O plugin roda no `nest build` e no `nest start`. O `openapi.json` sai do build e por isso tem os schemas. Os testes do Vitest compilam com o oxc, sem o plugin, então o documento dos testes não tem os schemas gerados.

## Health

`HealthController` (`src/shared/infra/health/`), com o `@nestjs/terminus`.

| Rota | Confere | Responde |
| --- | --- | --- |
| `GET /health/live` | Nada: o processo responde. Não passa pelo `HealthCheckService` | 200, inclusive durante o [atraso do desligamento](#atraso-do-desligamento) |
| `GET /health/ready` | `database`: `pingCheck` do TypeORM. `redis-cache` e `redis-queue`: `PING` pelo `RedisHealthIndicator`, no `client` da `CacheRedisConnection` e no `commands` da `QueueRedisConnection` ([Redis](../explanation/redis.md#dois-clientes-para-o-mesmo-endereço)). Cada um com limite de 1 s (`.withTimeout()`) | 200 com todos `up`. 503 com algum `down` (`status: 'error'`) ou com a app desligando (`status: 'shutting_down'`). Cada indicador traz `status` e `responseTime` (ms), e `message` quando falha |

O 503 é o corpo do Terminus (`{ status, info, error, details }`), em `application/json`, e não Problem Details: o `HealthController` responde o resultado direto, e a falha não passa pelo `ProblemDetailsFilter`. O Terminus loga a falha.

As duas rotas são públicas (`@Public()`), sem versão na URL (`VERSION_NEUTRAL`), fora do rate limit (`@SkipThrottle()`), sem log de acesso e sem span.

## Rate limit

`@nestjs/throttler`, com o `AppThrottlerGuard` global (`APP_GUARD` no `AppModule`), uma subclasse do `ThrottlerGuard`. As peças ficam em `src/shared/infra/http/rate-limit/`: o guard, o storage, o `@ThrottleByAccount` e as opções do `ThrottlerModule.forRootAsync` (`rate-limit.options.ts`), que o `AppModule` só repassa.

| Item | Valor |
| --- | --- |
| Limite padrão | 100 requisições por minuto, por IP. O IP vem do `trust proxy` |
| Limites próprios | Rotas de autenticação, com `@Throttle` ([Autenticação](autenticacao.md#rotas)) |
| Limites por conta | Opt-in por rota, com `@ThrottleByAccount(tracker)` (`throttle-by-account.decorator.ts`): o `tracker` do módulo tira a chave da requisição. As entradas `account-minute` (5 por minuto) e `account-hour` (20 por hora) ficam no `forRoot`, e o `skipIf` delas as pula fora das rotas marcadas, quando o `tracker` devolve `undefined` e com `THROTTLE_ENABLED=false`. Só o login usa |
| Bloqueio | Passado o limite, a chave fica bloqueada pelo mesmo prazo da janela (o `blockDuration` padrão é o `ttl`) |
| Resposta bloqueada | 429 `TOO_MANY_REQUESTS` em Problem Details, com `Retry-After` sem sufixo, seja qual for o throttler que bloqueou |
| Headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` em cada resposta permitida. Cada throttler nomeado tem os seus, com o nome no fim: `X-RateLimit-Limit-account-minute`, `X-RateLimit-Remaining-account-hour` |
| Contadores | No Redis, pelo `RedisThrottlerStorage`, na conexão `commands` da `QueueRedisConnection`: janela fixa a partir do primeiro acesso, num script Lua. O limite vale para a soma das instâncias |
| Redis fora do ar | 503 (`Rate limiting unavailable`) em toda rota com rate limit ([Redis fora do ar](#redis-fora-do-ar)) |
| Desligar | `THROTTLE_ENABLED=false` |
| Teste | `redis-throttler-storage.int-spec.ts` |

## Logs de acesso

`nestjs-pino`, configurado no `ObservabilityModule` (`src/shared/infra/observability/`). Uma linha por requisição.

| Item | Valor |
| --- | --- |
| Nível | `LOG_LEVEL` |
| Formato | JSON. Em `NODE_ENV=development`, `pino-pretty` em uma linha, sem `pid`, `hostname`, `req` e `res` |
| Mensagem | `GET /v1/orders 200 12ms` no sucesso, `GET /v1/orders 500 failed` no erro |
| Erro 5xx | Além da linha de acesso, o `ProblemDetailsFilter` loga um `error` com `err` (a stack), `method` e `path`. O corpo da resposta leva o `traceId`, o mesmo `trace_id` do log ([Respostas de erro](respostas-de-erro.md#log)) |
| `req` | `id`, `method` e `url` |
| `res` | `statusCode` |
| Trace | `trace_id` e `span_id` da requisição ([Observabilidade](../explanation/observabilidade.md)) |
| Fora do log | As rotas `/health` e `/health/*` |
| `redact` | `req.headers.authorization` e `req.headers.cookie`. O serializer de `req` já não leva headers. O `redact` cobre um serializer que passe a levar |

### `x-request-id`

| Caso | Id da requisição |
| --- | --- |
| Header `x-request-id` com 1 a 128 caracteres de `[A-Za-z0-9_-]` | O valor do header |
| Sem header, ou fora desse formato | Um UUID aleatório |

O id vai para o `req.id` do log e volta na resposta, no header `x-request-id`.

## Redis fora do ar

Nenhum uso espera o Redis voltar segurando uma requisição. O porquê de cada comportamento está em [Redis](../explanation/redis.md).

| Uso | Comportamento | Mensagem de log |
| --- | --- | --- |
| Cache | A leitura vai direto ao banco | `warn`: `redis connection error`, `cache store error` |
| Rate limit | 503 `SERVICE_UNAVAILABLE` (`Rate limiting unavailable`) na hora, em toda rota com rate limit. Com o rate limit ligado, a API inteira responde 503, menos o health, antes de chegar ao cache ou à outbox | `error`: `rate limit storage unavailable` |
| Outbox | Os eventos ficam na tabela, e o relay pausa: nenhuma linha conta a falha nem morre. Cada rodada da pausa falha na hora, ou no prazo de 5 s quando a fila do consumidor é nova (a `Queue` do BullMQ espera a conexão). A espera entre as rodadas dobra de 1 s até 30 s, e a entrega recomeça em até 30 s depois da volta do Redis ([Outbox e filas](outbox-e-filas.md#relay-da-outbox)) | `warn`: `outbox relay paused: event transport unavailable`, uma vez por pausa. `info`: `outbox relay resumed`, na volta |
| Workers das filas de eventos | Esperam a reconexão e voltam a processar sozinhos | `warn`: `queue redis connection error` (com `connection: 'commands'` ou `'blocking'`), `queue worker error` |
| Agendador de jobs | A subida falha cerca de 15 s depois da primeira tentativa de conexão: até 5 s esperando a conexão das filas, mais 10 s de timeout do registro dos jobs agendados. Com `JOBS_ENABLED=false`, nada é registrado, e a subida segue | Erro da subida: `<scheduler>: scheduler registration failed` |
| Métricas das filas | A coleta falha e a rodada fica sem os valores das filas. Se o Redis já estava fora na subida, a falha vem no prazo da coleta ([Observabilidade](observabilidade.md#coleta)) | `warn`: `queue metrics collection failed` |
| `/health/ready` | 503, com o `redis-cache` e o `redis-queue` `down` (`The client is offline` e `Stream isn't writeable and enableOfflineQueue options is false`). Volta a 200 quando o Redis volta. O `/health/live` não depende do Redis | O do Terminus |

A conexão do cache não bloqueia a subida: a app sobe sem cache, com o `warn` `redis connect failed`, e o `/health/ready` responde 503.

## Desligamento

Com o `enableShutdownHooks()`, o Nest captura os sinais de término (`SIGTERM`, `SIGINT` e os outros de `ShutdownSignal`) e roda os hooks nesta ordem. No fim, reenvia o sinal ao próprio processo.

| Fase | Quem | O que faz |
| --- | --- | --- |
| 1. `onModuleDestroy` | Workers das filas de eventos, `ScheduledJobProcessor` e `OutboxWorker` | Param de pegar trabalho e esperam o job ou o lote em andamento, com as conexões ainda abertas |
| | `OutboxMetrics` e `QueueMetrics` | Tiram o callback das métricas da outbox e das filas, para a última exportação da fase 4 não consultar o banco e o Redis já fechados. O `QueueMetrics` fecha as filas que lê |
| 2. `beforeApplicationShutdown` | `BullMqPublisher` | Fecha as filas em que enfileira. Só o worker da outbox publica, e ele já parou na fase 1 |
| | Terminus | Só no `SIGTERM`: espera `SHUTDOWN_GRACE_MS`, com o `/health/ready` em 503. Ver [Atraso do desligamento](#atraso-do-desligamento) |
| | `CacheRedisConnection` | Destrói o cliente do cache se ele estiver reconectando, para o `QUIT` da fase 4 não travar |
| 3. Servidor HTTP | Nest | Para de aceitar conexões e espera as requisições em andamento |
| 4. `onApplicationShutdown` | Cache | Desconecta o cliente do cache |
| | TypeORM | Fecha o `DataSource` |
| | `QueueRedisConnection` | Desconecta o `commands` e o `blocking` |
| | `TracingShutdown` | Espera o SDK do OpenTelemetry exportar os spans e as métricas pendentes |

Até a fase 3, o servidor aceita requisições. Os módulos rodam cada hook em sequência, os mais próximos do `AppModule` primeiro e os `@Global` por último. Por isso o `RedisModule`, dono das duas conexões, é global: a `CacheRedisConnection` só age depois do atraso do Terminus, e a `QueueRedisConnection` fecha depois que os workers e o publisher pararam.

### Atraso do desligamento

O `HealthModule` registra o `TerminusModule.forRootAsync` com `gracefulShutdownTimeoutMs` igual a `SHUTDOWN_GRACE_MS` ([Variáveis de ambiente](variaveis-de-ambiente.md#aplicação)). Com valor maior que `0`, ao receber o `SIGTERM`:

1. Os workers e os jobs param (fase 1). A instância deixa de processar filas e outbox, e as outras instâncias seguem processando.
2. O `/health/ready` passa a responder 503 com `status: 'shutting_down'`, e o `/health/live` segue em 200.
3. Durante `SHUTDOWN_GRACE_MS`, a app atende as requisições que chegarem, com o banco e o Redis abertos. O Terminus loga `Awaiting <ms>ms before shutdown`.
4. Passado o atraso, o servidor HTTP fecha (fase 3) e o resto do desligamento segue.

Outros sinais, como o `SIGINT` do Ctrl+C, não esperam. O padrão é `0`: sem atraso, como no desenvolvimento. Como escolher o valor e o prazo da plataforma está em [Como fazer o deploy](../how-to/fazer-o-deploy.md#tempo-de-desligamento).

Teste: `test/shutdown.e2e-spec.ts`.

Na imagem Docker, o PID 1 é o `tini` (`ENTRYPOINT` do `Dockerfile`), que repassa o sinal ao node. No `SIGTERM`, o container sai com 143.

Com `OTEL_METRICS_EXPORTER` ou `OTEL_LOGS_EXPORTER` no padrão (`otlp`) e sem coletor, a fase 4 espera o timeout da exportação, uns 8 s, no `TracingShutdown` ([Variáveis de ambiente](variaveis-de-ambiente.md#opentelemetry)).
