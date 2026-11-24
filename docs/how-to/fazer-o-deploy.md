---
type: how-to
---

# Como fazer o deploy

Use este guia para gerar a imagem Docker da API e colocá-la no ar: as migrations num passo antes, a app depois, e as probes da plataforma. Ele também mostra como testar a imagem na sua máquina com o profile `prod` do `docker-compose.yml`.

## Pré-requisitos

- Docker com BuildKit, o padrão do Docker atual.
- Um Postgres e um Redis acessíveis pela plataforma, e um servidor SMTP.
- As variáveis obrigatórias de [Variáveis de ambiente](../reference/variaveis-de-ambiente.md) definidas no ambiente da plataforma: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SMTP_URL` e `EMAIL_FROM`. Com `NODE_ENV=production`, que a imagem já define, os arquivos `.env` são ignorados.

## Passos

1. Gere a imagem:

   ```bash
   docker build -t ai-nest-ddd-clean:local .
   ```

   A imagem final tem só o `dist/`, as dependências de produção e o `scripts/run-scripts.mjs`, e roda como o usuário `node`. Um arquivo novo que o build precise entra no `.dockerignore`, que é uma lista de permitidos. Para outra versão do Node que não a do `.nvmrc`: `docker build --build-arg NODE_VERSION=<versão> -t ai-nest-ddd-clean:local .`.

2. Defina o ambiente da plataforma. Além das obrigatórias:

   - `TRUST_PROXY` com o número de proxies na frente da API, se houver um load balancer ([por quê](../reference/variaveis-de-ambiente.md#aplicação)).
   - `JWT_SECRET` gerado para produção, com 32 caracteres ou mais, e diferente do `.env.example`.
   - `OTEL_TRACES_EXPORTER=otlp` e `OTEL_EXPORTER_OTLP_ENDPOINT` para enviar os traces a um coletor. A imagem traz `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER` e `OTEL_LOGS_EXPORTER` em `none`, então sem coletor não há nada a definir ([por quê](../reference/variaveis-de-ambiente.md#tracing-opentelemetry)).
   - `QUEUE_WORKERS_ENABLED`, `OUTBOX_WORKER_ENABLED` e `JOBS_ENABLED` em `false` nas instâncias que só atendem HTTP, se você separar instâncias de API e de workers ([Workers e jobs](../reference/variaveis-de-ambiente.md#workers-e-jobs)).

3. Rode as migrations antes de a versão nova subir, com a mesma imagem e o mesmo ambiente da app, trocando só o comando:

   ```bash
   npm run db:migrate:prod
   ```

   Na plataforma, isso é um Job, um release command ou uma task one-shot que precisa terminar com sucesso antes do deploy da app. O comando roda o `mig:<módulo>:run:prod` de cada módulo, a partir do `dist/`. Um módulo em dia responde "No migrations are pending", então o passo pode rodar de novo sem risco, mas uma cópia por vez: o `migration:run` não trava contra outra execução simultânea. Use um único Job ou release command por deploy, nunca um initContainer por réplica. Os data sources validam o ambiente inteiro, por isso o passo precisa das mesmas variáveis da app. As migrations nunca rodam ao subir a app.

4. Suba a app com o comando padrão da imagem (`node dist/main.js`, porta `3000`) e configure as probes:

   - liveness em `GET /health/live`, que só confere se o processo responde;
   - readiness em `GET /health/ready`, que confere o Postgres e o Redis.

   A imagem não tem `HEALTHCHECK`: as plataformas usam as próprias probes. O que cada rota responde está em [Operação](../reference/operacao.md#health).

O desligamento já está pronto na imagem, com o `tini` como PID 1: ver [Operação](../reference/operacao.md#desligamento).

## Testar a imagem localmente

O profile `prod` do `docker-compose.yml` repete a ordem do deploy: o serviço `migrate` roda o `db:migrate:prod` e termina, e o `app` só sobe depois de ele terminar com sucesso. O ambiente dos dois vem da âncora `x-app-env`, com valores só para uso local. Os dois ficam fora do `docker compose up -d postgres redis mailpit` de sempre.

O projeto isolado (`-p ai-nest-deploy-check`) tem volumes próprios: as migrations rodam num banco vazio, e o banco de desenvolvimento não muda. Ele publica as mesmas portas do ambiente de desenvolvimento, então pare o de desenvolvimento antes. Não deixe `start:dev` nem o e2e rodando: o `app` usa a porta 3000, e uma segunda instância consumiria as filas do BullMQ.

1. Pare o ambiente de desenvolvimento, sem apagar os volumes:

   ```bash
   docker compose stop
   ```

2. Gere a imagem e suba tudo:

   ```bash
   docker compose -p ai-nest-deploy-check --profile prod up -d --build
   ```

3. Confira as migrations:

   ```bash
   docker compose -p ai-nest-deploy-check logs migrate
   docker compose -p ai-nest-deploy-check ps -a
   ```

   O log mostra cada migration aplicada, e o `migrate` aparece com `Exited (0)`.

4. Espere a app ficar pronta:

   ```bash
   curl --retry 20 --retry-all-errors --retry-delay 1 -fsS http://localhost:3000/health/ready
   ```

   O `--retry-all-errors` cobre o "Connection reset by peer" enquanto a app sobe: o Docker aceita a conexão na porta antes de a app escutar.

5. Baixe o projeto isolado e devolva o ambiente de desenvolvimento:

   ```bash
   docker compose -p ai-nest-deploy-check --profile prod down -v --remove-orphans
   docker compose start
   ```

## Como verificar

- O passo de migration termina com código 0. Rodado de novo, responde "No migrations are pending" em cada módulo:

  ```bash
  docker compose -p ai-nest-deploy-check --profile prod run --rm migrate
  ```

- `GET /health/ready` responde 200, com `database` e `redis` em `up`.
- `docker compose -p ai-nest-deploy-check stop app` termina em menos de 1 s, e `docker inspect -f '{{.State.ExitCode}}' ai-nest-deploy-check-app-1` mostra `143` (término por `SIGTERM`), e não `137` (`SIGKILL`).

## Antes do primeiro deploy

Itens adiados com o primeiro deploy como gatilho, em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados):

- a limpeza periódica de `shared.processed_events`, `orders.idempotency_keys` e das linhas mortas da outbox;
- o Redis separado em duas instâncias, uma para as filas e outra para o cache.

## Veja também

- [Comandos](../reference/comandos.md#migrations): o `db:migrate:prod` e os scripts `mig:<módulo>:run:prod`.
- [Variáveis de ambiente](../reference/variaveis-de-ambiente.md): todas as variáveis, com padrão e valores.
- [Operação](../reference/operacao.md): health, rate limit e desligamento.
- [Redis](../explanation/redis.md): o que acontece com a app quando o Redis cai.
