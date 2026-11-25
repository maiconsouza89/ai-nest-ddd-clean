---
type: how-to
---

# Como fazer o deploy

Use este guia para gerar a imagem Docker da API e colocá-la no ar: as migrations num passo antes, a app depois, e as probes da plataforma. Ele também mostra como testar a imagem na sua máquina com o profile `prod` do `docker-compose.yml`.

## Pré-requisitos

- Docker com BuildKit, o padrão do Docker atual.
- Um registry de imagens em que a plataforma consiga ler (GitHub Container Registry, Docker Hub, ECR...), com `docker login <registry>` feito na máquina ou no CI que publica.
- Um Postgres e um Redis acessíveis pela plataforma, e um servidor SMTP. O Postgres pode ser um serviço gerenciado: ver [Postgres externo](#postgres-externo).
- As variáveis obrigatórias de [Variáveis de ambiente](../reference/variaveis-de-ambiente.md) definidas no ambiente da plataforma: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SMTP_URL` e `EMAIL_FROM`. Com `NODE_ENV=production`, que a imagem já define, os arquivos `.env` são ignorados.

## Passos

1. Gere a imagem e publique-a no registry, com uma tag por versão:

   ```bash
   docker build -t <registry>/ai-nest-ddd-clean:$(git rev-parse --short HEAD) .
   docker push <registry>/ai-nest-ddd-clean:$(git rev-parse --short HEAD)
   ```

   O nome tem o formato `<registry>/<imagem>:<tag>`, como `ghcr.io/<usuário>/ai-nest-ddd-clean:3d10305`. Use uma tag fixa por versão, como o hash do commit, e não `latest`: o passo de migration e a app precisam rodar a mesma imagem, e voltar uma versão é trocar a tag. A tag `:local` do `docker-compose.yml` serve só para o teste local.

   A imagem final tem só o `dist/`, as dependências de produção e o `scripts/run-scripts.mjs`, e roda como o usuário `node`. Um arquivo novo que o build precise entra no `.dockerignore`, que é uma lista de permitidos. Para outra versão do Node que não a do `.nvmrc`, acrescente `--build-arg NODE_VERSION=<versão>` ao `docker build`.

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
   - readiness em `GET /health/ready`, que confere o Postgres e o Redis, e responde 503 enquanto a app desliga.

   A imagem não tem `HEALTHCHECK`: as plataformas usam as próprias probes. O que cada rota responde está em [Operação](../reference/operacao.md#health).

5. Defina `SHUTDOWN_GRACE_MS` para a instância sair da rota antes de parar de aceitar conexões, e ajuste o prazo de término da plataforma (`terminationGracePeriodSeconds` no Kubernetes) para caber o atraso. Com a readiness a cada 5 s e duas falhas para tirar a instância:

   ```yaml
   spec:
     terminationGracePeriodSeconds: 45
     containers:
       - name: app
         env:
           - name: SHUTDOWN_GRACE_MS
             value: '15000'
         readinessProbe:
           httpGet: { path: /health/ready, port: 3000 }
           periodSeconds: 5
           failureThreshold: 2
   ```

   Evite `failureThreshold: 1`: a readiness consulta o Postgres e o Redis, que todas as instâncias compartilham, e um único ping lento tiraria todas da rota ao mesmo tempo.

   A regra de cada valor está em [Operação](../reference/operacao.md#atraso-do-desligamento). Com o padrão `0`, a app fecha o servidor HTTP logo após o `SIGTERM`, e requisições que o balanceador ainda mandar caem.

O desligamento já está pronto na imagem, com o `tini` como PID 1: ver [Operação](../reference/operacao.md#desligamento).

## Postgres externo

Num Postgres gerenciado ou em outro servidor, nada muda na imagem: a app e as migrations leem o endereço, as credenciais e o SSL só do `DATABASE_URL`. O pool e os timeouts vêm das variáveis `DATABASE_*` de [Variáveis de ambiente](../reference/variaveis-de-ambiente.md#postgres), todas com padrão.

- **URL:** `postgres://<usuário>:<senha>@<host>:5432/<banco>?sslmode=verify-full`. Codifique na senha os caracteres reservados de URL (`@` vira `%40`, `:` vira `%3A`, `/` vira `%2F`, `#` vira `%23`).
- **SSL:** vai só na URL; o driver `pg` lê o `sslmode` dela.
  - Com certificado de uma CA pública, `sslmode=verify-full` basta.
  - Com CA própria do provedor, como no RDS, acrescente `&sslrootcert=<caminho do .pem>` e monte o arquivo no container pela plataforma (secret ou volume). A imagem não traz certificados de CA de provedor.
  - O `pg` trata `require`, `prefer` e `verify-ca` como `verify-full`, com um aviso no log. O `sslmode=no-verify` cifra sem conferir o certificado, e deixa a conexão aberta a quem se passar pelo servidor.
- **Permissões:** as migrations criam os schemas de cada módulo (`CREATE SCHEMA IF NOT EXISTS`), então o usuário do passo de migration precisa de `CREATE` no banco.
- **Rede:** o firewall ou o security group do Postgres precisa aceitar a plataforma onde o container roda.
- **Conexões:** cada instância abre até `DATABASE_POOL_MAX` conexões (padrão `10`). Mantenha `instâncias × DATABASE_POOL_MAX` abaixo do `max_connections` do banco (ou do limite do plano), com folga para o passo de migration, que usa o mesmo pool, e para o acesso administrativo. Com mais instâncias, baixe o `DATABASE_POOL_MAX` em vez de subir o `max_connections` ([Variáveis de ambiente](../reference/variaveis-de-ambiente.md#postgres)).
- **PgBouncer em modo transaction:** o PgBouncer recusa os parâmetros de conexão que não acompanha, e a app manda o `statement_timeout` e o `idle_in_transaction_session_timeout` assim. Defina `DATABASE_STATEMENT_TIMEOUT_MS=0` e `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS=0`, e ponha os limites no role do banco:

  ```sql
  ALTER ROLE <usuário> SET statement_timeout = '30s';
  ALTER ROLE <usuário> SET idle_in_transaction_session_timeout = '60s';
  ```

  Use um role à parte para o passo de migration, sem o `statement_timeout`, para uma migration longa não ser cancelada ([Persistência](../explanation/persistencia.md#pool-e-timeouts)).

Para conferir a conexão antes do deploy, rode a imagem com um arquivo de env fora do repositório (como `~/deploy/ai-nest.env`, com as variáveis obrigatórias e o `DATABASE_URL` externo):

```bash
docker run --rm --env-file ~/deploy/ai-nest.env <registry>/ai-nest-ddd-clean:<tag> npm run db:migrate:prod
docker run --rm --env-file ~/deploy/ai-nest.env -p 127.0.0.1:3000:3000 <registry>/ai-nest-ddd-clean:<tag>
```

O primeiro aplica as migrations no banco externo; o segundo sobe a app, e o `http://localhost:3000/health/ready` responde 200. Se o SSL falhar, o erro aparece já no primeiro, como `The server does not support SSL connections` ou um erro de certificado.

## Testar a imagem localmente

O profile `prod` do `docker-compose.yml` repete a ordem do deploy: o serviço `migrate` roda o `db:migrate:prod` e termina, e o `app` só sobe depois de ele terminar com sucesso. O ambiente dos dois vem da âncora `x-app-env`, com valores só para uso local. Os dois ficam fora do `docker compose up -d postgres redis mailpit` de sempre.

Só no checkout principal. O passo 1 para o stack de desenvolvimento, que é também o de todos os worktrees, e num worktree o `docker compose` sem `-p` mira o projeto do principal (o `COMPOSE_PROJECT_NAME` do `.env` gerado): um `--profile prod up` sem o `-p` recriaria o `migrate` e o `app` do principal com o código da branch e aplicaria as migrations dela no banco `app`.

O projeto isolado (`-p ai-nest-deploy-check`) tem volumes próprios: as migrations rodam num banco vazio, e o banco de desenvolvimento não muda. Ele publica as mesmas portas do ambiente de desenvolvimento, então pare o de desenvolvimento antes. Não deixe `start:dev` nem o e2e rodando, nem nos worktrees: o `app` usa a porta 3000, e uma segunda instância consumiria as filas do BullMQ.

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
- `docker compose -p ai-nest-deploy-check stop app` termina em menos de 1 s (com `SHUTDOWN_GRACE_MS` no padrão, `0`), e `docker inspect -f '{{.State.ExitCode}}' ai-nest-deploy-check-app-1` mostra `143` (término por `SIGTERM`), e não `137` (`SIGKILL`).

## Antes do primeiro deploy

Itens adiados com o primeiro deploy como gatilho, em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados):

- a limpeza periódica de `shared.processed_events`, `orders.idempotency_keys` e das linhas mortas da outbox;
- o Redis separado em duas instâncias, uma para as filas e outra para o cache.

## Veja também

- [Comandos](../reference/comandos.md#migrations): o `db:migrate:prod` e os scripts `mig:<módulo>:run:prod`.
- [Variáveis de ambiente](../reference/variaveis-de-ambiente.md): todas as variáveis, com padrão e valores.
- [Operação](../reference/operacao.md): health, rate limit e desligamento.
- [Redis](../explanation/redis.md): o que acontece com a app quando o Redis cai.
