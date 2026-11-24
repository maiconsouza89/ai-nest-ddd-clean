---
type: reference
---

# Variáveis de ambiente

O `.env.example` traz todas as variáveis com valores de desenvolvimento. Copie-o para `.env` no [setup](comandos.md#setup-do-zero). Para criar uma variável, ver [Como adicionar uma variável de ambiente](../how-to/adicionar-uma-variavel-de-ambiente.md).

## Carga

- Fora de produção, a app lê `.env.local` e depois `.env`. A primeira definição vence, e uma variável já definida no ambiente vence as duas.
- Com `NODE_ENV=production`, os arquivos são ignorados e só o ambiente vale.
- A app valida as variáveis ao subir, em `src/shared/infra/config/env.validation.ts`, e não sobe se uma delas for inválida. A mensagem lista cada problema.
- Uma variável que mudou de nome também barra a subida: `JWT_EXPIRES_IN_SECONDS` virou `JWT_ACCESS_TTL_SECONDS`.
- As variáveis `OTEL_*` são lidas pelo `src/tracing.ts`, que carrega o `.env` pela mesma regra, antes da app. Elas não passam pela validação.
- O `tracing.ts` e os DataSources da CLI de migrations rodam fora do `ConfigModule` e aplicam a mesma regra pelo `loadEnvFiles()` (`src/shared/infra/config/load-env-files.ts`).

## Aplicação

| Variável | Padrão | Valores | O que faz |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, `production` | Em `production`: ignora os arquivos `.env`, tira o Swagger e avisa se `TRUST_PROXY=0`. Em `development`: logs coloridos em uma linha. Os seeds só rodam em `development` ou `test` |
| `PORT` | `3000` | 1 a 65535 | Porta HTTP |
| `CORS_ORIGINS` | vazio | Origens separadas por vírgula | Vazio desliga o CORS |
| `TRUST_PROXY` | `0` | Inteiro ≥ 0 | Quantos proxies confiáveis estão na frente da API. Atrás de um proxy, com `0` todos os clientes compartilham o IP do proxy e o mesmo limite do rate limit |
| `THROTTLE_ENABLED` | `true` | `true`, `false` | Rate limit (100 requisições por minuto por IP, com limites menores nas rotas de [autenticação](autenticacao.md)). Os contadores ficam no Redis, então o limite vale para a soma das instâncias |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` | Nível do log (pino) |

## Infraestrutura

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `DATABASE_URL` | obrigatória | Conexão com o Postgres. No `.env.example`, o Postgres do `docker-compose.yml` |
| `REDIS_URL` | obrigatória | Conexão com o Redis: cache de leitura, filas do BullMQ e contadores do rate limit. No `.env.example`, o Redis do `docker-compose.yml` |
| `SMTP_URL` | obrigatória, inclusive nos scripts de migration e de seed | Servidor SMTP dos e-mails do notifications, `smtp://` ou `smtps://`, com usuário e senha na URL se houver (`smtps://usuario:senha@smtp.exemplo.com:465`). No `.env.example`, o Mailpit do `docker-compose.yml` (`smtp://127.0.0.1:1025`) |
| `EMAIL_FROM` | obrigatória, inclusive nos scripts de migration e de seed | Remetente dos e-mails, como `no-reply@example.com` ou `App <no-reply@example.com>` |

## Autenticação

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `JWT_SECRET` | obrigatória | Segredo do HS256, com 32 caracteres ou mais |
| `JWT_ACCESS_TTL_SECONDS` | `900` (15 minutos) | Validade do access token. Curta porque um access token não pode ser revogado antes de vencer |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` (30 dias) | Validade de cada refresh token. Cada renovação emite um novo |
| `REFRESH_FAMILY_MAX_AGE_SECONDS` | `7776000` (90 dias) | Prazo absoluto da sessão, contado do login. Renovar não o estende. Depois dele, só com a senha de novo |
| `EMAIL_VERIFICATION_CODE_TTL_SECONDS` | `600` (10 minutos) | Validade do código de verificação do e-mail, contada da emissão. No mínimo `60`: o e-mail mostra a validade em minutos |

Como esses prazos se combinam está em [Autenticação](autenticacao.md).

## Workers e jobs

Os quatro interruptores aceitam `true` ou `false`. Desligue os workers e os jobs nas instâncias que só atendem HTTP.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `OUTBOX_WORKER_ENABLED` | `true` | Worker que publica os eventos gravados na outbox |
| `QUEUE_WORKERS_ENABLED` | `true` | Workers das filas de eventos (BullMQ) |
| `JOBS_ENABLED` | `true` | Jobs agendados. Com várias instâncias, só uma executa cada job por vez |
| `ORDER_EXPIRATION_MINUTES` | `1440` | Minutos sem alteração até um pedido em `DRAFT` ou `PLACED` ser cancelado pelo job de expiração |

## Tracing (OpenTelemetry)

São as variáveis padrão do SDK do OpenTelemetry. As mais usadas:

| Variável | No `.env.example` | O que faz |
| --- | --- | --- |
| `OTEL_TRACES_EXPORTER` | `none` | `otlp` envia a um coletor, `console` imprime cada span no terminal (muito ruído) e `none` não exporta. Sem spans, os logs saem sem `trace_id` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | não definida | Endereço do coletor, com `otlp` |
| `OTEL_SERVICE_NAME` | `ai-nest-ddd-clean` | Nome do serviço nos spans |
| `OTEL_SDK_DISABLED` | não definida | `true` desliga a instrumentação por completo |

## Testes

O `test/setup-env.ts` define o mínimo para os testes que sobem o `AppModule`, sem sobrescrever o que já estiver no ambiente:

- `NODE_ENV=test`, mais `DATABASE_URL`, `REDIS_URL` e `SMTP_URL` apontando para o `docker-compose.yml`, `EMAIL_FROM` e um `JWT_SECRET` fixo, só de teste;
- `OUTBOX_WORKER_ENABLED`, `QUEUE_WORKERS_ENABLED`, `JOBS_ENABLED` e `THROTTLE_ENABLED` em `false`;
- `LOG_LEVEL=silent` e `OTEL_SDK_DISABLED=true`.

Os testes de integração ignoram `DATABASE_URL`, `REDIS_URL` e `SMTP_URL` e sobem containers próprios.
