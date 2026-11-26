---
type: reference
---

# Variáveis de ambiente

Cada variável que a app, as migrations, os seeds e os testes leem, com o padrão, os valores aceitos e o efeito. O `.env.example` traz todas com valores de desenvolvimento, e o `.env` sai dele na [preparação do ambiente local](../how-to/preparar-o-ambiente-local.md). Para criar uma variável, ver [Como adicionar uma variável de ambiente](../how-to/adicionar-uma-variavel-de-ambiente.md).

## Carga

- Fora de produção, a app lê `.env.local` e depois `.env`. A primeira definição vence, e uma variável já definida no ambiente vence as duas.
- Com `NODE_ENV=production`, os arquivos são ignorados e só o ambiente vale.
- A app valida as variáveis ao subir, em `src/shared/infra/config/env.validation.ts`, e não sobe se uma delas for inválida. A mensagem lista cada problema.
- Uma variável que mudou de nome também barra a subida: `JWT_EXPIRES_IN_SECONDS` virou `JWT_ACCESS_TTL_SECONDS`.
- As variáveis `OTEL_*` são lidas pelo `src/tracing.ts`, que carrega o `.env` pela mesma regra, antes da app. Elas não passam pela validação.
- O `tracing.ts` e os DataSources da CLI, usados pelas migrations e pelos seeds, rodam fora do `ConfigModule` e aplicam a mesma regra pelo `loadEnvFiles()` (`src/shared/infra/config/load-env-files.ts`). Os DataSources chamam também o mesmo `validateEnv` da app: uma variável obrigatória é exigida também pelos scripts de migration e de seed.

## Aplicação

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, `production` | Em `production`: ignora os arquivos `.env`, tira o Swagger e avisa se `TRUST_PROXY=0`. Em `development`: logs coloridos em uma linha. Os seeds só rodam em `development` ou `test` |
| `PORT` | `3000` | 1 a 65535 | Porta HTTP |
| `CORS_ORIGINS` | vazio | Origens separadas por vírgula | Vazio desliga o CORS |
| `TRUST_PROXY` | `0` | Inteiro ≥ 0 | Quantos proxies confiáveis estão na frente da API. Atrás de um proxy, com `0` todos os clientes compartilham o IP do proxy e o mesmo limite do rate limit |
| `THROTTLE_ENABLED` | `true` | `true`, `false` | Rate limit (100 requisições por minuto por IP, com limites menores nas rotas de [autenticação](autenticacao.md) e o limite por conta do login). Os contadores ficam no Redis, então o limite vale para a soma das instâncias |
| `SHUTDOWN_GRACE_MS` | `0` | 0 a 600000 (10 minutos), em ms | Atraso do desligamento no `SIGTERM`: o `/health/ready` responde 503 e a app segue atendendo, antes de o servidor HTTP fechar. `0` desliga ([Atraso do desligamento](operacao.md#atraso-do-desligamento)). Como escolher o valor está em [Como fazer o deploy](../how-to/fazer-o-deploy.md#tempo-de-desligamento) |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` | Nível do log (pino) |

## Infraestrutura

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `DATABASE_URL` | obrigatória | URL do Postgres (`postgres://<usuário>:<senha>@<host>:<porta>/<banco>`), com `sslmode` e `sslrootcert` opcionais | Conexão com o Postgres. No `.env.example`, o Postgres do `docker-compose.yml`. Ver [Postgres](#postgres) |
| `REDIS_URL` | obrigatória | URL do Redis, com o banco lógico opcional no fim (`/N`) | Conexão com o Redis: cache de leitura, filas do BullMQ e contadores do rate limit. No `.env.example`, o Redis do `docker-compose.yml` |
| `SMTP_URL` | obrigatória | `smtp://` ou `smtps://`, com usuário e senha na URL se houver (`smtps://usuario:senha@smtp.exemplo.com:465`) | Servidor SMTP dos e-mails do notifications. No `.env.example`, o Mailpit do `docker-compose.yml` (`smtp://127.0.0.1:1025`) |
| `EMAIL_FROM` | obrigatória | Endereço, como `no-reply@example.com`, ou nome e endereço, como `App <no-reply@example.com>` | Remetente dos e-mails |

## Postgres

Pool e timeouts da conexão, todos opcionais. Sem a variável, vale o padrão do projeto, não o do driver `pg`, que deixa as três esperas sem limite. Por que cada limite existe está em [Persistência](../explanation/persistencia.md#pool-e-timeouts).

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `DATABASE_POOL_MAX` | `10` | Inteiro ≥ 1 | Conexões no pool de cada processo |
| `DATABASE_CONNECT_TIMEOUT_MS` | `5000` | 1 a 2147483647, em ms | Prazo para conseguir uma conexão: abrir uma nova ou esperar na fila do pool cheio. Passado, a operação falha com `timeout exceeded when trying to connect` |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `30000` | 0 a 2147483647, em ms | `statement_timeout` da sessão: o servidor cancela a query mais longa que isso (SQLSTATE `57014`). `0` não manda o parâmetro, e vale o do servidor ou do role |
| `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS` | `60000` | 0 a 2147483647, em ms | `idle_in_transaction_session_timeout` da sessão: o servidor encerra a sessão com transação aberta e ociosa por mais que isso. `0` não manda o parâmetro, e vale o do servidor ou do role |

- Definir um dos dois timeouts de query vazio (`DATABASE_STATEMENT_TIMEOUT_MS=`) barra a subida: vazio não vale como `0`.
- O total de conexões abertas no Postgres é `instâncias × DATABASE_POOL_MAX`, e tem de caber no `max_connections` do servidor (ou no limite do plano). O passo de migration usa o mesmo pool.
- As migrations e os seeds usam o mesmo pool e o mesmo `DATABASE_CONNECT_TIMEOUT_MS`, mas rodam sem os dois timeouts de query.
- A app e os DataSources da CLI montam a conexão pela mesma função, `postgresOptions` (`src/shared/infra/database/postgres-options.ts`).
- O SSL não tem variável: vai no `sslmode` e no `sslrootcert` da `DATABASE_URL`. O `sslrootcert` é o caminho de um arquivo `.pem` com a CA, que o `pg` lê.

| `sslmode` na `DATABASE_URL` | Tratamento pelo `pg` (`pg-connection-string` 2.14) |
| --- | --- |
| Ausente ou `disable` | Sem SSL |
| `verify-full` | SSL, conferindo o certificado e o nome do servidor |
| `prefer`, `require`, `verify-ca` | Iguais ao `verify-full`, com um aviso `SECURITY WARNING` do Node (`process.emitWarning`) |
| `no-verify` | SSL sem conferir o certificado: a conexão fica aberta a quem se passar pelo servidor |
| Qualquer um, com `uselibpqcompat=true` na URL | A semântica da libpq: `prefer` e `require` não conferem o certificado (`require` com `sslrootcert` confere a CA), `verify-ca` confere a CA sem o nome e falha sem `sslrootcert` |

## Autenticação

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `JWT_SECRET` | obrigatória | Texto com 32 caracteres ou mais | Segredo do HS256 |
| `JWT_ACCESS_TTL_SECONDS` | `900` (15 minutos) | Inteiro ≥ 1, em segundos | Validade do access token |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` (30 dias) | Inteiro ≥ 1, em segundos | Validade de cada refresh token. Cada renovação emite um novo |
| `REFRESH_FAMILY_MAX_AGE_SECONDS` | `7776000` (90 dias) | Inteiro ≥ 1, em segundos | Prazo absoluto da sessão, contado do login. Renovar não o estende. Depois dele, só com a senha de novo |
| `EMAIL_VERIFICATION_CODE_TTL_SECONDS` | `600` (10 minutos) | Inteiro ≥ 60, em segundos | Validade do código de verificação do e-mail, contada da emissão. O e-mail mostra a validade em minutos |

Como esses prazos se combinam está em [Autenticação](autenticacao.md).

## Workers e jobs

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `OUTBOX_WORKER_ENABLED` | `true` | `true`, `false` | Worker que publica os eventos gravados na outbox |
| `QUEUE_WORKERS_ENABLED` | `true` | `true`, `false` | Workers das filas de eventos (BullMQ) |
| `JOBS_ENABLED` | `true` | `true`, `false` | Jobs agendados. Com `false`, a instância não registra os agendadores nem sobe os workers dos jobs, e não executa nenhum. Com várias instâncias, só uma executa cada job por vez. Uma falha em `run()` vai para o log como `<scheduler> failed` e não é repetida: a próxima tentativa é o próximo disparo |
| `ORDER_EXPIRATION_MINUTES` | `1440` | Inteiro ≥ 1 | Minutos sem alteração até um pedido em `DRAFT` ou `PLACED` ser cancelado pelo job de expiração |

## OpenTelemetry

São as variáveis padrão do SDK do OpenTelemetry. As mais usadas:

O padrão é o do SDK, sem a variável. O `.env.example` define as três `OTEL_*_EXPORTER` como `none` e o `OTEL_SERVICE_NAME`, e a imagem Docker define as três `OTEL_*_EXPORTER` como `none`.

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `OTEL_TRACES_EXPORTER` | `otlp` | `otlp`, `console`, `none` | `otlp` envia a um coletor, `console` imprime cada span no terminal e `none` não exporta. Sem spans, os logs saem sem `trace_id` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | URL | Endereço do coletor, com `otlp` |
| `OTEL_METRICS_EXPORTER` | `otlp` | `otlp`, `prometheus`, `console`, `none` | Métricas de HTTP, do pool do Postgres, do runtime do Node, da outbox e das filas de eventos ([Observabilidade](../explanation/observabilidade.md#métricas)). `otlp` envia ao coletor, `prometheus` sobe um servidor para o Prometheus ler, `console` imprime no terminal a cada 60 s e `none` não exporta. Com `otlp` e sem coletor, o desligamento espera uns 8 s pelo timeout da exportação |
| `OTEL_METRIC_EXPORT_INTERVAL` | `60000` | Inteiro, em ms | Intervalo da exportação das métricas com `otlp`. O `console` não lê a variável e exporta a cada 60 s |
| `OTEL_EXPORTER_PROMETHEUS_HOST` | `localhost` | Endereço | Endereço do servidor do `prometheus`. Com `localhost`, num container, o servidor é inalcançável de fora. O `/metrics` não tem autenticação |
| `OTEL_EXPORTER_PROMETHEUS_PORT` | `9464` | Porta | Porta do servidor do `prometheus`. Dois worktrees com `prometheus` disputam a porta. A imagem Docker não a expõe |
| `OTEL_LOGS_EXPORTER` | `otlp` | `otlp`, `console`, `none` | Logs pelo SDK. Mesmo atraso do `OTEL_METRICS_EXPORTER`. Os logs da app saem pelo pino, não por aqui |
| `OTEL_SERVICE_NAME` | — | Texto | Nome do serviço nos spans e nas métricas. No `.env.example`, `ai-nest-ddd-clean` |
| `OTEL_SDK_DISABLED` | `false` | `true`, `false` | `true` desliga a instrumentação por completo |
| `OTEL_RESOURCE_ATTRIBUTES` | — | `chave=valor` separados por vírgula | Atributos do recurso nos spans e nas métricas. Fora do `.env.example`. Num worktree, o `worktree:setup` acrescenta `deployment.environment.name=wt<N>` aos que o `.env` do principal tiver |

## Worktree

Escritas pelo `npm run worktree:setup` no `.env` de um `git worktree` ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)). O checkout principal não tem nenhuma. A app não lê as duas primeiras, e elas ficam fora da validação.

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `WORKTREE_SLOT` | — | `1` a `15` | O slot do worktree. A trava dos comandos (`scripts/worktree-guard.mjs`) exige a variável num worktree, e o setup a usa para não reservar o slot de novo |
| `MAILPIT_TAG` | — | `wt<N>` | A tag dos e-mails do worktree no Mailpit. O e2e filtra por ela |
| `COMPOSE_PROJECT_NAME` | — | O nome do projeto do principal | Variável do Docker Compose, lida do `.env`: aponta o `docker compose` do worktree para o stack do principal |
| `OTEL_RESOURCE_ATTRIBUTES` | — | Os do principal, mais `deployment.environment.name=wt<N>` | Os atributos dos traces, com o ambiente do worktree |

O setup também reescreve `PORT` (`3000 + N`), o banco da `DATABASE_URL` (`app_wt<N>`), o banco lógico do `REDIS_URL` (`/N`) e o usuário do `SMTP_URL` (`wt<N>:x`, que o Mailpit vira tag). Um `.env.local` copiado do principal sai sem essas chaves, para não vencer o `.env` gerado.

## Testes

Antes dos valores de teste, o `test/setup-env.ts` copia do `.env.local` e do `.env` do checkout, na precedência da app e sem vencer o ambiente, só `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`, `MAILPIT_API_URL` e `MAILPIT_TAG`. Num worktree, o e2e usa assim o banco, o Redis e a tag dele. Com `NODE_ENV=production` no ambiente, os arquivos não são lidos. As outras chaves do `.env` não entram, para o `THROTTLE_ENABLED`, o `LOG_LEVEL` e os workers não vazarem para os testes.

Depois, define o mínimo para os testes que sobem o `AppModule`, sem sobrescrever o que já estiver no ambiente:

- `NODE_ENV=test`, mais `DATABASE_URL`, `REDIS_URL` e `SMTP_URL` apontando para o `docker-compose.yml` quando os arquivos não as definem, `EMAIL_FROM` e um `JWT_SECRET` fixo, só de teste;
- `OUTBOX_WORKER_ENABLED`, `QUEUE_WORKERS_ENABLED`, `JOBS_ENABLED` e `THROTTLE_ENABLED` em `false`;
- `LOG_LEVEL=silent` e `OTEL_SDK_DISABLED=true`.

Os testes de integração ignoram `DATABASE_URL`, `REDIS_URL` e `SMTP_URL` e sobem containers próprios.
