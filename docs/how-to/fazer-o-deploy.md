---
type: how-to
---

# Como fazer o deploy

Use este guia para gerar a imagem Docker da API e colocá-la no ar numa plataforma, com as migrations num passo antes da app.

## Pré-requisitos

- Docker com BuildKit, o padrão do Docker atual.
- Um registry de imagens em que a plataforma consiga ler (GitHub Container Registry, Docker Hub, ECR...), com `docker login <registry>` feito na máquina ou no CI que publica.
- Um Postgres e um Redis acessíveis pela plataforma, e um servidor SMTP. Para um Postgres gerenciado, siga antes [Como usar um Postgres gerenciado](usar-um-postgres-gerenciado.md).
- As variáveis obrigatórias de [Variáveis de ambiente](../reference/variaveis-de-ambiente.md) definidas no ambiente da plataforma: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SMTP_URL` e `EMAIL_FROM`. Com `NODE_ENV=production`, que a imagem já define, os arquivos `.env` são ignorados.
- No primeiro deploy, os itens adiados com ele como gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md): a limpeza periódica de `shared.processed_events`, `orders.idempotency_keys` e das linhas mortas da outbox, e o Redis separado em duas instâncias, uma para as filas e outra para o cache.

## Passos

1. Gere a imagem e publique-a no registry, com uma tag por versão:

   ```bash
   docker build -t <registry>/ai-nest-ddd-clean:$(git rev-parse --short HEAD) .
   docker push <registry>/ai-nest-ddd-clean:$(git rev-parse --short HEAD)
   ```

   O nome tem o formato `<registry>/<imagem>:<tag>`, como `ghcr.io/<usuário>/ai-nest-ddd-clean:3d10305`. Use uma tag fixa por versão, como o hash do commit, e não `latest`: o passo de migration e a app rodam a mesma imagem, e voltar uma versão é trocar a tag. A tag `:local` do `docker-compose.yml` serve só para o teste local.

   Um arquivo novo que o build precisa entra no `.dockerignore`, que é uma lista de permitidos: acrescente uma linha `!<caminho>`. Para outra versão do Node que não a do `.nvmrc`, acrescente `--build-arg NODE_VERSION=<versão>` ao `docker build`.

2. Defina o ambiente da plataforma. Além das obrigatórias:

   - `TRUST_PROXY` com o número de proxies na frente da API, se houver um load balancer.
   - `JWT_SECRET` gerado para produção, com 32 caracteres ou mais, e diferente do `.env.example`.
   - Com um coletor, `OTEL_TRACES_EXPORTER=otlp`, `OTEL_METRICS_EXPORTER=otlp` e o `OTEL_EXPORTER_OTLP_ENDPOINT`. A imagem traz `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER` e `OTEL_LOGS_EXPORTER` em `none`, então sem coletor não há nada a definir.
   - Se você separar instâncias de API e de workers, `QUEUE_WORKERS_ENABLED`, `OUTBOX_WORKER_ENABLED` e `JOBS_ENABLED` em `false` nas instâncias que só atendem HTTP.

   Cada variável, com padrão e valores, está em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md).

3. Rode as migrations antes de a versão nova subir, com a mesma imagem e as mesmas variáveis da app, trocando só o comando:

   ```bash
   npm run db:migrate:prod
   ```

   Na plataforma, use um único Job, release command ou task one-shot por deploy, nunca um initContainer por réplica, e só faça o deploy da app depois de ele terminar com sucesso. Rode uma cópia por vez: o `migration:run` não trava contra outra execução simultânea. Um módulo em dia responde "No migrations are pending", então o passo pode rodar de novo depois que o anterior terminar.

4. Suba a app com o comando padrão da imagem (`node dist/main.js`, porta `3000`) e configure as probes:

   - liveness em `GET /health/live`, que só confere se o processo responde;
   - readiness em `GET /health/ready`, que confere o Postgres e o Redis, e responde 503 enquanto a app desliga.

   A imagem não tem `HEALTHCHECK`: as plataformas usam as próprias probes. O que cada rota responde está em [Operação](../reference/operacao.md).

5. Ajuste o [tempo de desligamento](#tempo-de-desligamento).

## Tempo de desligamento

Defina `SHUTDOWN_GRACE_MS` para a instância sair da rota antes de parar de aceitar conexões, e o prazo de término da plataforma para caber o atraso. Com o padrão `0`, a app fecha o servidor HTTP logo após o `SIGTERM`, e as requisições que o balanceador ainda mandar caem.

| Ajuste | Regra |
| --- | --- |
| `SHUTDOWN_GRACE_MS` | No mínimo o tempo para a readiness ser marcada como falha (`periodSeconds` × `failureThreshold` da readiness probe), mais a margem para o balanceador propagar a remoção. Com `periodSeconds: 5` e `failureThreshold: 2`, `15000` |
| `terminationGracePeriodSeconds` do Kubernetes (padrão 30 s) | Maior que `SHUTDOWN_GRACE_MS` somado ao tempo do job em andamento, das requisições em andamento e do fechamento das conexões. Se não couber, a plataforma manda o `SIGKILL`, e o container sai com 137 |
| `stop_grace_period` do Compose (padrão 10 s) ou `stopTimeout` do ECS (padrão 30 s) | A mesma regra do `terminationGracePeriodSeconds` |

No Kubernetes, com a readiness a cada 5 s e duas falhas para tirar a instância:

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

Não use `failureThreshold: 1`: a readiness consulta o Postgres e o Redis, que todas as instâncias compartilham, e um único ping lento tiraria todas da rota ao mesmo tempo.

A imagem já tem o `tini` como PID 1, que repassa o `SIGTERM` ao node. A ordem do desligamento está em [Operação](../reference/operacao.md).

## Como verificar

- O Job de migration do deploy termina com código 0.
- A readiness em `GET /health/ready` responde 200 na plataforma, com `database`, `redis-cache` e `redis-queue` em `up`, e a plataforma põe as instâncias novas na rota.
- Num rollout, as instâncias antigas saem com código 143 (término por `SIGTERM`), e não 137 (`SIGKILL`).

## Veja também

- [Como testar a imagem de produção localmente](testar-a-imagem-de-producao-localmente.md): a mesma ordem de deploy na sua máquina, com o profile `prod`.
- [Como usar um Postgres gerenciado](usar-um-postgres-gerenciado.md): a URL, o SSL, as permissões e o PgBouncer.
- [Comandos → Migrations](../reference/comandos.md#migrations): o `db:migrate:prod` e os scripts `mig:<módulo>:run:prod`.
- [Variáveis de ambiente](../reference/variaveis-de-ambiente.md): todas as variáveis, com padrão e valores.
- [Operação](../reference/operacao.md): health, rate limit e desligamento.
- [Redis](../explanation/redis.md): o que acontece com a app quando o Redis cai.
