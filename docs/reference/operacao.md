---
type: reference
---

# Operação

O que a app liga na subida e no desligamento: a configuração HTTP, o Swagger, o health check, o rate limit, os logs de acesso e a ordem de desligamento. As variáveis que mudam cada item estão em [Variáveis de ambiente](variaveis-de-ambiente.md), e os endereços com a app no ar em [Comandos](comandos.md#setup-do-zero).

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
| Montagem | `setupSwagger` (`src/shared/infra/http/swagger.setup.ts`), com `addBearerAuth()` |
| Tags | Uma por controller: `auth`, `orders`, `products`, `health` |
| Rotas com token | `@ApiBearerAuth()` no controller (`orders`, `products`) |
| Respostas de erro | Schema `ProblemDetailsResponse`, em `application/problem+json`. Cada rota documenta os próprios erros com `@ApiProblemResponse(status, descrição)`, e o `setupSwagger` acrescenta o 429 e o 500 em toda operação |
| Teste | `test/docs.e2e-spec.ts`: `/docs` responde 200 sem token, toda rota tem exatamente uma tag, e as do auth e do health caem na tag certa. O schema de erro existe, e toda operação documenta o 429 e o 500 com ele |

O plugin da CLI do Nest (`nest-cli.json`) gera os schemas dos DTOs e as respostas das rotas.

| Opção | Valor | Efeito |
| --- | --- | --- |
| `dtoFileNameSuffix` | `.request.ts`, `.requests.ts`, `.query.ts` | Arquivos lidos como DTO. O padrão do plugin é `.dto.ts` e `.entity.ts`, que o projeto não usa |
| `classValidatorShim` | `true` | Os decorators do `class-validator` viram regras no schema (`minLength`, `maximum`) |
| `introspectComments` | `true` | O comentário `/** */` da rota vira o resumo, e o da propriedade, a descrição |

O plugin roda no `nest build` e no `nest start`. Os testes do Vitest compilam com o oxc, sem o plugin, então o documento dos testes não tem os schemas gerados.

## Health

`HealthController` (`src/shared/infra/health/`), com o `@nestjs/terminus`.

| Rota | Confere | Responde |
| --- | --- | --- |
| `GET /health/live` | Nada: o processo responde. Não passa pelo `HealthCheckService` | 200, inclusive durante o [atraso do desligamento](#atraso-do-desligamento) |
| `GET /health/ready` | `database`: `pingCheck` do TypeORM. `redis`: `PING` pelo `RedisHealthIndicator`. Cada um com limite de 1 s (`.withTimeout()`) | 200 com todos `up`. 503 com algum `down` (`status: 'error'`) ou com a app desligando (`status: 'shutting_down'`). Cada indicador traz `status` e `responseTime` (ms), e `message` quando falha |

O 503 é o corpo do Terminus (`{ status, info, error, details }`), em `application/json`, e não Problem Details: o `HealthController` responde o resultado direto, e a falha não passa pelo `ProblemDetailsFilter`. O Terminus loga a falha.

As duas rotas são públicas (`@Public()`), sem versão na URL (`VERSION_NEUTRAL`), fora do rate limit (`@SkipThrottle()`), sem log de acesso e sem span.

## Rate limit

`@nestjs/throttler`, com o `AppThrottlerGuard` global (`APP_GUARD` no `AppModule`), uma subclasse do `ThrottlerGuard` em `src/shared/infra/http/`.

| Item | Valor |
| --- | --- |
| Limite padrão | 100 requisições por minuto, por IP. O IP vem do `trust proxy` |
| Limites próprios | Rotas de autenticação, com `@Throttle` ([Autenticação](autenticacao.md#rotas)) |
| Limites por conta | Opt-in por rota, com `@ThrottleByAccount(tracker)` (`throttle-by-account.decorator.ts`): o `tracker` do módulo tira a chave da requisição. As entradas `account-minute` (5 por minuto) e `account-hour` (20 por hora) ficam no `forRoot`, e o `skipIf` delas as pula fora das rotas marcadas, quando o `tracker` devolve `undefined` e com `THROTTLE_ENABLED=false`. Só o login usa |
| Bloqueio | Passado o limite, a chave fica bloqueada pelo mesmo prazo da janela (o `blockDuration` padrão é o `ttl`) |
| Resposta bloqueada | 429 `TOO_MANY_REQUESTS` em Problem Details, com `Retry-After` sem sufixo, seja qual for o throttler que bloqueou |
| Headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` em cada resposta permitida. Cada throttler nomeado tem os seus, com o nome no fim: `X-RateLimit-Limit-account-minute`, `X-RateLimit-Remaining-account-hour` |
| Contadores | No Redis, pelo `RedisThrottlerStorage` (`src/shared/infra/http/`): janela fixa a partir do primeiro acesso, num script Lua. O limite vale para a soma das instâncias |
| Redis fora do ar | 503 (`Rate limiting unavailable`) em toda rota com rate limit ([Redis](../explanation/redis.md#redis-fora-do-ar-cada-uso-falha-do-seu-jeito)) |
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

## Desligamento

Com o `enableShutdownHooks()`, o Nest captura os sinais de término (`SIGTERM`, `SIGINT` e os outros de `ShutdownSignal`) e roda os hooks nesta ordem. No fim, reenvia o sinal ao próprio processo.

| Fase | Quem | O que faz |
| --- | --- | --- |
| 1. `onModuleDestroy` | Workers das filas de eventos, `ScheduledJobProcessor` e `OutboxWorker` | Param de pegar trabalho e esperam o job ou o lote em andamento, com as conexões ainda abertas |
| | `OutboxMetrics` e `QueueMetrics` | Tiram o callback das métricas da outbox e das filas, para a última exportação da fase 4 não consultar o banco e o Redis já fechados. O `QueueMetrics` fecha as filas que lê |
| 2. `beforeApplicationShutdown` | `BullMqPublisher` | Fecha as filas em que enfileira. Só o worker da outbox publica, e ele já parou na fase 1 |
| | Terminus | Só no `SIGTERM`: espera `SHUTDOWN_GRACE_MS`, com o `/health/ready` em 503. Ver [Atraso do desligamento](#atraso-do-desligamento) |
| | `RedisConnection` | Destrói o cliente do cache se ele estiver reconectando, para o `QUIT` da fase 4 não travar |
| 3. Servidor HTTP | Nest | Para de aceitar conexões e espera as requisições em andamento |
| 4. `onApplicationShutdown` | `BullMqConnection` | Desconecta o `producer` e o `worker` |
| | Cache | Desconecta o cliente do cache |
| | TypeORM | Fecha o `DataSource` |
| | `TracingShutdown` | Espera o SDK do OpenTelemetry exportar os spans e as métricas pendentes |

Até a fase 3, o servidor aceita requisições. Os módulos rodam cada hook em sequência, os mais próximos do `AppModule` primeiro e os `@Global` por último, então o `RedisConnection` só age depois do atraso do Terminus.

### Atraso do desligamento

O `HealthModule` registra o `TerminusModule.forRootAsync` com `gracefulShutdownTimeoutMs` igual a `SHUTDOWN_GRACE_MS` ([Variáveis de ambiente](variaveis-de-ambiente.md#aplicação)). Com valor maior que `0`, ao receber o `SIGTERM`:

1. Os workers e os jobs param (fase 1). A instância deixa de processar filas e outbox, e as outras instâncias seguem processando.
2. O `/health/ready` passa a responder 503 com `status: 'shutting_down'`, e o `/health/live` segue em 200.
3. Durante `SHUTDOWN_GRACE_MS`, a app atende as requisições que chegarem, com o banco e o Redis abertos. O Terminus loga `Awaiting <ms>ms before shutdown`.
4. Passado o atraso, o servidor HTTP fecha (fase 3) e o resto do desligamento segue.

Outros sinais, como o `SIGINT` do Ctrl+C, não esperam. O padrão é `0`: sem atraso, como no desenvolvimento.

| Ajuste | Regra |
| --- | --- |
| `SHUTDOWN_GRACE_MS` | No mínimo o tempo para a readiness ser marcada como falha (`periodSeconds` × `failureThreshold` da readiness probe), mais a margem para o balanceador propagar a remoção. Com `periodSeconds: 5` e `failureThreshold: 2`, `15000` |
| `terminationGracePeriodSeconds` do Kubernetes (padrão 30 s) | Maior que `SHUTDOWN_GRACE_MS` somado ao tempo das fases 1, 3 e 4 (o job em andamento, as requisições em andamento e o fechamento das conexões). Se não couber, a plataforma manda o `SIGKILL` e o container sai com 137 |
| Outras plataformas | O mesmo prazo tem outro nome: o `stop_grace_period` do Compose (padrão 10 s) e o `stopTimeout` do ECS (padrão 30 s) |

Teste: `test/shutdown.e2e-spec.ts`.

Na imagem Docker, o PID 1 é o `tini` (`ENTRYPOINT` do `Dockerfile`), que repassa o sinal ao node. Com o node como PID 1, o kernel ignora o sinal que o Nest reenvia a si mesmo no fim, porque o PID 1 não tem handler padrão. Se sobrar um handle aberto, o container só sai no `SIGKILL` da plataforma, com código 137. Com o `tini`, ele sai com 143, término por `SIGTERM`. O passo a passo está em [Como fazer o deploy](../how-to/fazer-o-deploy.md).

Com `OTEL_METRICS_EXPORTER` ou `OTEL_LOGS_EXPORTER` no padrão (`otlp`) e sem coletor, a fase 4 espera o timeout da exportação, uns 8 s, no `TracingShutdown`. Sem coletor, deixe os dois em `none` ([Variáveis de ambiente](variaveis-de-ambiente.md#opentelemetry)).
