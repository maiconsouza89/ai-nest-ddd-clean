# Plano do deploy com Docker: imagem, migrations a partir do `dist/` e how-to

Resolve a issue #10. Hoje o template não tem como ir para produção: não há `Dockerfile`, `.dockerignore` nem how-to de deploy. As migrations também não têm caminho em produção: os scripts `mig:*:run` usam o `typeorm-ts-node-esm` sobre o `src/`, e o `ts-node` é devDependency, ausente numa imagem com `npm ci --omit=dev`.

O que já funciona e não muda:

- Os data sources carregam `migrations/*.{ts,js}`, como a documentação do TypeORM 1.1 recomenda para rodar a partir do JavaScript compilado (Context7, 2026-11-24). O `tsconfig.build.json` já compila os data sources e as migrations para o `dist/`, e os aliases `#shared/*` caem no `dist/` pela condição `default`.
- O binário `typeorm` vem do pacote `typeorm`, que é dependência de produção.
- Com `NODE_ENV=production`, o `loadEnvFiles` ignora os arquivos `.env`, o Swagger não sobe e o `pino-pretty` (devDependency) não é carregado.
- Os seeds ficam fora: o `tsconfig.build.json` exclui `**/seeds/**`, e o `run-seed.ts` recusa rodar fora de `development` e `test`.
- O `argon2` traz binário pronto para glibc e musl, em x64 e arm64.

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Quando as migrations rodam | Num passo separado do deploy, antes de a versão nova subir. Nunca ao subir a app (documentação do Nest, production checklist) |
| Runner de migrations | Um `mig:<módulo>:run:prod` por módulo (`typeorm migration:run -d dist/.../<módulo>.data-source.js`) e um `db:migrate:prod` que roda todos pelo `scripts/run-scripts.mjs`, com o padrão `^mig:.+:run:prod$`. O `plop module` gera o script novo. O `^mig:.+:run$` do `db:setup` não casa com `:run:prod` |
| Env do passo de migration | O mesmo da app. Os data sources chamam `validateEnv`, que exige todas as variáveis obrigatórias. Validar só o `DATABASE_URL` vira gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md) |
| Imagem base | `node:${NODE_VERSION}-slim` (glibc), com `ARG NODE_VERSION=24` alinhado ao `.nvmrc`, nos dois estágios. Tem npm, que o `db:migrate:prod` usa |
| Estágios | Build: `npm ci` e `npm run build`. Final: `npm ci --omit=dev`, só o `dist/` e o `scripts/run-scripts.mjs`, usuário `node`, `NODE_ENV=production`, `EXPOSE 3000`, `CMD ["node", "dist/main.js"]` |
| PID 1 | `tini` como `ENTRYPOINT`. O Nest reenvia o sinal ao próprio processo no fim do desligamento, e o kernel ignora esse sinal no PID 1 sem handler |
| `HEALTHCHECK` | Fora da imagem. As plataformas usam as próprias probes: `/health/live` para liveness e `/health/ready` para readiness, descritas no how-to |
| `.dockerignore` | Lista de permitidos: `*` e depois `!src`, `!package*.json`, `!tsconfig*.json`, `!nest-cli.json` e `!scripts/run-scripts.mjs` |
| Verificação local | Profile `prod` no `docker-compose.yml`, com um `migrate` one-shot e um `app` que sobe depois de o `migrate` terminar com sucesso. Env compartilhado por uma âncora `x-app-env`, sem `env_file` |
| `db:status:prod` (`migration:show`) | Fora. Vira gatilho em Evoluções com gatilho |
| Job de imagem no CI | Fora. Vira gatilho em Evoluções com gatilho |
| Itens "Antes do primeiro deploy" de Evoluções com gatilho | O how-to só lista os itens, com link. Nada é implementado aqui |
| ADR e glossário | Sem ADR: nada aqui é difícil de reverter. Sem termo de domínio novo |

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**. O **Pronto quando** é o critério de aceite: o passo só é marcado quando todos os itens dele forem conferidos.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. As mais usadas aqui: `docs/reference/comandos.md`, `docs/reference/operacao.md`, `docs/reference/variaveis-de-ambiente.md`, `docs/explanation/redis.md` e `docs/README.md`.
- Antes de escrever o Dockerfile, o compose e os scripts, consulte o Context7 (CLI do TypeORM 1.x, Deployment do Nest, Docker e Docker Compose), como pede o `AGENTS.md`. O que não estiver no Context7 vem da documentação oficial na web, e o **Como ficou** diz isso.
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Tudo num PR só, na branch `feat/deploy-docker`. Commit, push e PR só com o ok do dono do repositório.
- Os comandos do Docker afetam só este projeto. Para baixar o ambiente, use só `docker compose down -v --remove-orphans` (com `-p` quando o passo indicar), nunca `docker volume prune` nem `docker system prune`.
- Quando todos os passos estiverem ✅ e o PR for mergeado, apague este arquivo, tire a rota "Continuar um plano em andamento" do `AGENTS.md` e atualize a seção "Fora dos quadrantes" do `docs/README.md`. O registro fica no histórico do git.

## Mapa

> **Status:** 🟡 Em andamento · **Início:** 2026-11-24
>
> - [x] Passo 1: scripts de migration a partir do `dist/`
> - [x] Passo 2: `plop module` gera o `mig:<nome>:run:prod`
> - [x] Passo 3: `Dockerfile` e `.dockerignore`
> - [x] Passo 4: profile `prod` no `docker-compose.yml`
> - [x] Passo 5: desligamento com o `tini`
> - [x] Passo 6: documentação
> - [ ] Passo 7: entrega

A ordem importa: os scripts (passo 1) vêm antes da imagem, que os chama, e a imagem vem antes do compose, que a constrói. A documentação vem depois, para descrever o que foi conferido.

---

### Passo 1: scripts de migration a partir do `dist/`

**Por quê:** a imagem final não tem `ts-node`. A CLI do TypeORM roda um data source `.js` direto, e os data sources compilados já carregam as migrations compiladas.

**Faça:**

- No `package.json`, um `mig:<módulo>:run:prod` para cada um dos 5 data sources, ao lado do `mig:<módulo>:run` dele, com `typeorm migration:run -d <data source no dist>`:
  - `identity`: `dist/modules/identity/infra/database/typeorm/identity.data-source.js`
  - `orders`: `dist/modules/orders/infra/database/typeorm/orders.data-source.js`
  - `catalog`: `dist/modules/catalog/database/catalog.data-source.js`
  - `inventory`: `dist/modules/inventory/infra/database/typeorm/inventory.data-source.js`
  - `outbox`: `dist/shared/infra/outbox/outbox.data-source.js`
- Sem `NODE_OPTIONS=--conditions=@app/source`: aqui o alias tem que cair no `dist/`.
- `db:migrate:prod`, logo depois do `db:setup`: `node scripts/run-scripts.mjs "^mig:.+:run:prod$"`.
- Confira no Context7 a sintaxe do `migration:run` do TypeORM 1.x (flag `-d`, data source ESM em `.js`).

**Pronto quando:**

- Com o Postgres do compose no ar e `npm run build` feito, `npm run db:migrate:prod` roda os 5 scripts e termina com código 0. Um banco em dia responde "No migrations are pending" em cada um.
- `npm run db:setup` continua rodando só os 5 `mig:<módulo>:run`. A saída não tem nenhum `:run:prod`.
- Depois de `rm -r dist`, `npm run mig:identity:run:prod` falha com erro de arquivo não encontrado, e não com outro erro qualquer.
- `npm run ci` passa.

**Como ficou:** ✅ Como no "Faça". Context7 (TypeORM 1.1.1, "Executing and reverting"): o `migration:run` só roda `.js` e recebe o data source com `-d`. Conferido: `db:migrate:prod` roda os 5 scripts com "No migrations are pending" e código 0; `db:setup` roda só os 5 `mig:<módulo>:run`, sem nenhum `:run:prod` na saída; sem o `dist/`, o `mig:identity:run:prod` falha com `ERR_MODULE_NOT_FOUND` no `identity.data-source.js`; `npm run ci` passa. O comentário do `scripts/run-scripts.mjs` passou a citar o `db:migrate:prod`.

### Passo 2: `plop module` gera o `mig:<nome>:run:prod`

**Por quê:** um módulo novo precisa entrar no `db:migrate:prod` sem edição à mão, como já entra no `db:setup`.

**Faça:**

- No `plopfile.mjs`, na ação que grava os scripts no `package.json`, acrescente `mig:${kebab}:run:prod` com `typeorm migration:run -d dist/modules/${kebab}/infra/database/typeorm/${kebab}.data-source.js`. O caminho do `dist/` sai do caminho do `src/` que a ação já monta, não de uma segunda string escrita à mão.
- Atualize a mensagem de retorno da ação para citar os três scripts.

**Pronto quando:**

- `npm run plop module plan-check` acrescenta ao `package.json` os scripts `mig:plan-check:gen`, `mig:plan-check:run` e `mig:plan-check:run:prod`, e o caminho do `:run:prod` aponta para um arquivo que existe em `dist/` depois de `npm run build`.
- O módulo de teste é desfeito por completo: `git restore` nos arquivos modificados que o plop listou e `rm -r` só nos caminhos que ele criou. `git status` volta a mostrar só as mudanças deste plano.
- `npm run ci` passa.

**Como ficou:** ✅ Como no "Faça": o caminho do `dist/` sai do `ds` com troca de `src/` por `dist/` e de `.ts` por `.js`. Conferido: `npm run plop module plan-check` gerou os três scripts, e o `dist/modules/plan-check/infra/database/typeorm/plan-check.data-source.js` existia depois do build. Desfeito com `git restore` no `docs/README.md` e no `src/app.module.ts`, `rm -r` nos caminhos criados (e no `dist/modules/plan-check`). O `package.json` já tinha as mudanças do passo 1, então nele saíram só as 3 linhas do `plan-check`, em vez de `git restore`. `npm run ci` passa.

### Passo 3: `Dockerfile` e `.dockerignore`

**Por quê:** é o que leva a app para produção. A documentação do Nest (Deployment) pede `NODE_ENV=production node dist/main.js` e sugere multi-stage e só dependências de produção.

**Faça:**

- `.dockerignore` como lista de permitidos: `*`, depois `!src`, `!package.json`, `!package-lock.json`, `!tsconfig.json`, `!tsconfig.build.json`, `!nest-cli.json` e `!scripts/run-scripts.mjs`. Um comentário no topo diz que um arquivo novo que o build precise entra aqui.
- `Dockerfile`:
  - `ARG NODE_VERSION=24` antes do primeiro `FROM`. Um comentário diz que ele acompanha o `.nvmrc`.
  - Estágio `build` (`node:${NODE_VERSION}-slim`): copia `package*.json`, `npm ci`, depois copia `tsconfig*.json`, `nest-cli.json` e `src/`, e roda `npm run build`. O `npm ci` vem antes do código para aproveitar o cache de camada.
  - Estágio final (`node:${NODE_VERSION}-slim`): instala o `tini` (`apt-get install -y --no-install-recommends tini` e limpa `/var/lib/apt/lists`), `ENV NODE_ENV=production`, `WORKDIR /app`, copia `package*.json`, `npm ci --omit=dev` e `npm cache clean --force`, copia `scripts/run-scripts.mjs` e o `dist/` do estágio `build`, `USER node`, `EXPOSE 3000`, `ENTRYPOINT ["/usr/bin/tini", "--"]` e `CMD ["node", "dist/main.js"]`.
  - Os arquivos ficam com dono `root`: o usuário `node` lê e não altera o código.
- Confira no Context7, ou na documentação oficial do Docker, as boas práticas de imagem Node (multi-stage, `--init`/tini, usuário sem root).

**Pronto quando:**

- `docker build -t ai-nest-ddd-clean:local .` termina sem erro. Um segundo build, sem mudança, usa o cache em todas as camadas.
- `docker run --rm ai-nest-ddd-clean:local whoami` imprime `node`.
- `docker run --rm ai-nest-ddd-clean:local sh -c 'test ! -e node_modules/ts-node && test ! -e node_modules/vitest && echo ok'` imprime `ok`: só dependências de produção.
- `docker run --rm ai-nest-ddd-clean:local ls -A` mostra só `dist`, `node_modules`, `package.json`, `package-lock.json` e `scripts`. Nada de `.env`, `src`, `test`, `docs` ou `.git`.
- `docker run --rm ai-nest-ddd-clean:local printenv NODE_ENV` imprime `production`.
- O **Como ficou** registra o tamanho da imagem (`docker image ls ai-nest-ddd-clean:local`).

**Como ficou:** ✅ Context7 (Docker docs, guia de Node.js e `docker run --init`): multi-stage, `--omit=dev`, forma exec no `ENTRYPOINT`/`CMD`; o `--init` do Docker é o próprio tini. Diferenças do "Faça":

- **`--omit=optional`.** O `npm ci --omit=dev` mantinha o `ts-node` e o `typescript`: o `ts-node` é peer opcional do `typeorm` e devDependency nossa, e o lockfile o marca `devOptional` (recalculado do zero, dá o mesmo). O `--omit=peer` não muda nada. A primeira versão apagava os dois com `rm -rf`, porque eu achava que o `--omit=optional` tiraria o `@grpc/proto-loader` de que o `@grpc/grpc-js` de produção depende. O `/simplify` mostrou que não: o `@grpc/grpc-js` usa um `@grpc/proto-loader@0.8.1` aninhado e sem flag, e o da raiz só vem do `dockerode` (dev) e de um peer opcional do `@nestjs/terminus`. Com o ok do dono do repositório, ficou `npm ci --omit=dev --omit=optional`. Ele tira o `ts-node`, o `typescript` e as ~16 dependências deles. Das dependências de produção, sai só o `msgpackr-extract` (a aceleração nativa do msgpackr, que cai para JavaScript puro), o `pg-cloudflare` e o `@pkgjs/parseargs`. Conferido na imagem: o import de `@grpc/grpc-js`, `@opentelemetry/sdk-node`, `typeorm`, `bullmq`, `pg`, `@nestjs/terminus`, `argon2` e `msgpackr` funciona.
- **Cache do npm.** Os dois `npm ci` usam `--mount=type=cache,target=/root/.npm`, no lugar do `npm cache clean --force`. Uma mudança no `package.json`, como a de um `plop module`, não baixa tudo de novo.
- **`NPM_CONFIG_UPDATE_NOTIFIER=false`**, para o npm do `db:migrate:prod` não consultar o registry a cada `npm run`.

Conferido: o segundo build usa o cache nas 12 camadas; `whoami` = `node`; o teste do `ts-node` e do `vitest` imprime `ok`; `ls -A` mostra só `dist`, `node_modules`, `package-lock.json`, `package.json` e `scripts`; `NODE_ENV` = `production`; nenhum link quebrado no `.bin`. Tamanho: 599 MB no `docker image ls` (632 MB com o `ts-node` e o `typescript`). Os passos 4 e 5 rodaram de novo com essa imagem, com o mesmo resultado (19 migrations, `/health/ready` = 200, `stop` em 0,55 s, saída 143).

### Passo 4: profile `prod` no `docker-compose.yml`

**Por quê:** é o critério de pronto da issue: o container sobe contra o Postgres e o Redis do docker-compose, com as migrations rodando a partir da imagem. O profile repete a ordem do deploy (migrations, depois a app) num comando só, e não sobe no `docker compose up -d postgres redis mailpit` de sempre.

**Faça:**

- No topo do `docker-compose.yml`, a âncora `x-app-env` com o mínimo para a validação passar: `NODE_ENV: production`, `DATABASE_URL` com o host `postgres`, `REDIS_URL` com o host `redis`, um `JWT_SECRET` de 32+ caracteres que diga que é só local, `SMTP_URL: smtp://mailpit:1025`, `EMAIL_FROM` e `OTEL_TRACES_EXPORTER: none`. Um comentário diz que os valores são só para testar a imagem localmente.
- Serviço `migrate`: `profiles: [prod]`, `build: .`, `image: ai-nest-ddd-clean:local`, `command: ['npm', 'run', 'db:migrate:prod']`, `environment: *app-env`, `depends_on` do `postgres` com `condition: service_healthy`.
- Serviço `app`: `profiles: [prod]`, `image: ai-nest-ddd-clean:local`, `ports: ['127.0.0.1:3000:3000']`, `environment: *app-env`, `depends_on` com `migrate: service_completed_successfully`, mais `postgres`, `redis` e `mailpit` com `service_healthy`. A porta 3000 é a mesma do `start:dev`, de propósito: com ele no ar, o `app` não sobe, e o conflito aparece na hora, em vez de duas instâncias disputando as filas do BullMQ.
- Confira no Context7, ou na documentação oficial do Compose, os `profiles`, o `service_completed_successfully` e como o `up --wait` trata um serviço one-shot que termina. Se o `--wait` acusar falha com o `migrate` encerrado, use `up -d` seguido do `curl` com retry abaixo, e registre isso no **Como ficou**.

**Pronto quando:**

Conferido num projeto isolado, com volumes próprios, para as migrations rodarem num banco vazio sem tocar no banco de desenvolvimento:

1. `docker compose stop` para o ambiente de desenvolvimento sem apagar volumes, e não há `start:dev` nem e2e rodando.
2. `docker compose -p ai-nest-deploy-check --profile prod up -d --build` sobe tudo.
3. `docker compose -p ai-nest-deploy-check logs migrate` mostra as migrations dos 5 data sources aplicadas, e `docker compose -p ai-nest-deploy-check ps -a` mostra o `migrate` com `Exited (0)`.
4. `curl --retry 20 --retry-connrefused --retry-delay 1 -fsS http://localhost:3000/health/ready` responde 200 com `database` e `redis` `up`.
5. `docker compose -p ai-nest-deploy-check --profile prod run --rm migrate` de novo responde "No migrations are pending" nos 5 e termina com código 0.
6. `docker compose -p ai-nest-deploy-check --profile prod down -v --remove-orphans` apaga só o projeto isolado, e `docker compose start` devolve o ambiente de desenvolvimento.

E, no projeto padrão:

- `docker compose up -d postgres redis mailpit` não sobe o `migrate` nem o `app` (`docker compose ps -a` não os lista).
- `docker compose config --quiet` passa, com e sem `--profile prod`.

**Como ficou:** ✅ Context7 (código do Docker Compose, `dependency_wait.go` e `start.go`): o `up --wait` espera um one-shot sair com 0 quando outro serviço depende dele com `service_completed_successfully`. Diferenças do "Faça":

- O `x-app-env` ganhou `OTEL_METRICS_EXPORTER: none` e `OTEL_LOGS_EXPORTER: none` (ver o passo 5), e o `.env.example` também.
- O `curl` do item 4 falha com "Connection reset by peer" (código 56) enquanto a app sobe: o docker-proxy aceita a conexão antes de a app escutar, e o `--retry-connrefused` não cobre o reset. Com `--retry-all-errors` no lugar dele, chega ao 200. O how-to usa esse.

Conferido, no projeto `ai-nest-deploy-check`: o `up -d --build` subiu tudo; o log do `migrate` mostra as migrations dos 5 data sources aplicadas, e o `ps -a` mostra o `migrate` com `Exited (0)`; `/health/ready` = 200 com `database` e `redis` `up`; o `run --rm migrate` de novo responde 5 "No migrations are pending" com código 0; o `down -v --remove-orphans` apagou só os volumes do projeto isolado, e o `docker compose start` devolveu o ambiente de desenvolvimento. No projeto padrão, o `up -d postgres redis mailpit` não lista `migrate` nem `app`, e o `config --quiet` passa com e sem `--profile prod`. O único aviso no log do `app` é o esperado `TRUST_PROXY=0 em produção`.

### Passo 5: desligamento com o `tini`

**Por quê:** com o node como PID 1, o sinal que o Nest reenvia a si mesmo no fim do desligamento é ignorado. Se sobrar um handle aberto, o container espera o `SIGKILL` (10 s no Docker, 30 s no Kubernetes). O `tini` como PID 1 repassa o sinal ao node, que deixa de ser o PID 1.

**Faça:**

- Com o profile `prod` no ar, como no passo 4, meça o desligamento com e sem o `tini`.
- Sem o `tini`, para comparar: `docker run` da mesma imagem com `--entrypoint node` e o `dist/main.js`, na rede do projeto isolado e com o mesmo env.

**Pronto quando:**

- `time docker compose -p ai-nest-deploy-check stop app` termina bem antes dos 10 s do timeout do Docker.
- `docker compose -p ai-nest-deploy-check logs app` mostra as fases do desligamento de [Operação](../reference/operacao.md#desligamento), sem erro.
- `docker inspect` do `app` parado mostra um código de saída de término por sinal (143) ou 0, e não 137 (`SIGKILL`).
- O **Como ficou** registra os dois tempos medidos, com e sem `tini`.

**Como ficou:** ✅ Com diferenças do previsto:

- **Atraso do OpenTelemetry.** Com o env do plano, o desligamento levava ~8,6 s, com ou sem `tini`. O `NodeSDK` liga os exporters de métricas e de logs por padrão (`otlp`), e o `sdk.shutdown()` espera o timeout da exportação para um coletor que não existe. Isolado desligando uma peça de cada vez: sem workers, outbox ou jobs, continua em ~8 s; com `OTEL_SDK_DISABLED=true`, cai para 226 ms; com `OTEL_METRICS_EXPORTER=none` e `OTEL_LOGS_EXPORTER=none`, cai para ~200 ms. Com o ok do dono do repositório, as duas entraram no `x-app-env`, no `.env.example` e na documentação, sem mudança no `src/`. O `.env` local de quem já usa o template não muda sozinho.
- **Timeout local de 1 s.** Neste Docker Desktop (engine 28.5.1), todo container nasce com `StopTimeout=1`, até um `docker run` simples, em vez dos 10 s do padrão. Por isso, com o atraso acima, o `docker compose stop` mandava `SIGKILL` em ~1,5 s e saía 137. As medições abaixo usam `docker stop -t 30` para medir o tempo real.
- **Sem log das fases.** Os hooks de desligamento não escrevem log, então o `logs app` não mostra as fases. Conferido que não há linha de erro: o único aviso é o `TRUST_PROXY=0`.

Tempos (`docker run` na rede do projeto isolado, mesmo env, `docker stop -t 30`):

| Env | Com `tini` | Sem `tini` (`--entrypoint node`) |
| --- | --- | --- |
| Do plano (métricas e logs em `otlp`) | 8,6 s, saída 143 | 8,6 s, saída 0 |
| Métricas e logs em `none` | 198 ms, saída 143 | 222 ms, saída 0 |

Sem handle preso, os dois tempos empatam: sem `tini`, o node ignora o `SIGTERM` reenviado no PID 1 e sai sozinho (0) quando o event loop esvazia. O `tini` muda o código de saída (143, término por sinal) e protege o caso em que sobra um handle aberto. Com o env novo, `time docker compose -p ai-nest-deploy-check stop app` levou 0,47 s, e o `docker inspect` mostra saída 143.

### Passo 6: documentação

**Por quê:** a definição de pronto do `AGENTS.md` exige a página do quadrante afetado, e a issue pede `docs/reference/comandos.md` com os scripts novos.

**Faça:**

- `npm run plop doc how-to "fazer o deploy"` gera `docs/how-to/fazer-o-deploy.md` ("Como fazer o deploy"). Conteúdo:
  - Build da imagem e o `ARG NODE_VERSION`.
  - O passo de migration antes da app nova: `npm run db:migrate:prod` com a mesma imagem e o mesmo env da app, por exemplo um Job, um release command ou uma task. Ele pode rodar de novo sem risco.
  - As variáveis obrigatórias, com link para [Variáveis de ambiente](../reference/variaveis-de-ambiente.md), e os cuidados de produção: `TRUST_PROXY` atrás de proxy, `JWT_SECRET` forte, `OTEL_*`, `QUEUE_WORKERS_ENABLED`, `OUTBOX_WORKER_ENABLED` e `JOBS_ENABLED` por tipo de instância.
  - As probes: `/health/live` em liveness e `/health/ready` em readiness, com link para [Operação](../reference/operacao.md#health).
  - O `tini` e o desligamento.
  - Testar a imagem localmente com o profile `prod`, com o aviso de não deixar `start:dev` nem e2e rodando junto.
  - "Antes do primeiro deploy": a lista dos itens de [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados), só com link.
- `docs/README.md`: a linha do how-to novo na lista "Como fazer".
- `docs/reference/comandos.md`:
  - Em Migrations, `db:migrate:prod` e `mig:<módulo>:run:prod`, e por que esses não usam `@app/source`.
  - Em Geradores, o `plop module` cria também o `mig:<nome>:run:prod`.
  - Uma seção ou linha curta para o profile `prod` do compose, com link para o how-to.
- `docs/how-to/remover-os-modulos-de-exemplo.md`, passo 6: acrescente `mig:orders:run:prod`, `mig:catalog:run:prod` e `mig:inventory:run:prod`, e diga que o `db:migrate:prod` também acha os scripts pelo nome.
- `docs/how-to/rodar-as-migrations-e-os-seeds.md`: uma linha que aponta para o how-to de deploy, para quem procura as migrations em produção.
- `docs/reference/operacao.md`, em Desligamento: o PID 1 e o `tini` da imagem.
- `docs/reference/evolucoes-com-gatilho.md`, três linhas novas:
  - Infraestrutura e dados: "O pipeline de deploy precisar barrar uma versão com migration pendente": um `db:status:prod` com `typeorm migration:show` sobre o `dist/`.
  - Infraestrutura e dados: "O passo de migration rodar com um usuário de banco próprio ou com menos secrets que a app": os data sources validam só o `DATABASE_URL`, e não o env inteiro.
  - CI: "O primeiro deploy automatizado, ou um PR quebrar a imagem sem o CI acusar": um job `docker` com build pelo Buildx e cache do GitHub Actions, `docker compose --profile prod up`, `/health/ready` = 200 e o job no `needs` do `ci`. Contexto: ficou de fora pelo custo de CI enquanto não há deploy automatizado.
- `README.md`: se ele tiver uma seção de uso ou de comandos, uma linha com link para o how-to de deploy.

**Pronto quando:**

- `npm run docs:check` passa, sem comentário de template sobrando no how-to.
- `comandos.md`, `rodar-as-migrations-e-os-seeds.md`, `remover-os-modulos-de-exemplo.md` e `operacao.md` citam o `db:migrate:prod`, o `tini` ou o how-to de deploy, cada uma onde o assunto dela pede.
- Cada comando do how-to foi rodado como está escrito, no passo 4 ou de novo agora, e funcionou.
- `npm run docs:links` passa, se houver rede.

**Como ficou:** ✅ Como no "Faça", com dois acréscimos que vêm do passo 5: `OTEL_METRICS_EXPORTER` e `OTEL_LOGS_EXPORTER` em `variaveis-de-ambiente.md`, e um parágrafo sobre o atraso que eles causam no Desligamento de `operacao.md`. O `README.md` ganhou uma seção "Deploy" de uma linha, e o how-to entrou na linha de how-to da tabela "Documentação". Em `comandos.md`, além do previsto, a linha do `npm run build` aponta para o how-to. O how-to usa o projeto isolado `-p ai-nest-deploy-check` do passo 4, para não tocar no banco de desenvolvimento, e o `curl` com `--retry-all-errors`. Conferido: `npm run docs:check` passa; cada comando do how-to rodou como está escrito, inclusive o `--build-arg NODE_VERSION=24` e a verificação (19 migrations aplicadas, `/health/ready` = 200, 5 "No migrations are pending" na segunda rodada, `stop` em 0,66 s com saída 143); `npm run docs:links` passa, sem erro.

### Passo 7: entrega

**Por quê:** é a definição de pronto e o fluxo de entrega do `AGENTS.md`.

**Faça:**

- `npm run ci`.
- `npm run test:int` e `npm run test:e2e` não são exigidos: a mudança não toca em código de `src/`, banco, Redis, filas nem HTTP, só em scripts, imagem, compose e docs. Se algum arquivo de `src/` mudar no caminho, rode os dois.
- `/simplify` sobre as mudanças, depois `/code-review`.
- Com o ok do dono do repositório: commit, push e PR que fecha a #10, com o corpo citando os tempos do passo 5 e o tamanho da imagem do passo 3.

**Pronto quando:**

- `npm run ci` passa.
- O `/simplify` e o `/code-review` rodaram, e cada achado foi corrigido ou tem o motivo de ficar registrado no **Como ficou**.
- Os itens de "Pronto quando" da issue #10 foram conferidos: a imagem é gerada, o container sobe contra o Postgres e o Redis do compose com `/health/ready` em 200, as migrations rodam a partir da imagem sem `ts-node`, o `npm run ci` passa e o `comandos.md` lista os scripts novos.
- O CI do PR passa.

**Como ficou:** 🟡 Falta o commit, o push, o PR e o CI do PR, que esperam o ok do dono do repositório. `npm run ci` passa. `test:int` e `test:e2e` não rodaram: nada mudou no `src/`.

`/simplify` (reuso, simplificação, eficiência e altitude). Corrigido:

- `npm ci --omit=dev --omit=optional` no lugar do `rm -rf` por nome (ver o passo 3).
- Cache mount do npm e `NPM_CONFIG_UPDATE_NOTIFIER=false` no Dockerfile.
- A explicação do atraso do OpenTelemetry fica em `variaveis-de-ambiente.md` e `operacao.md`. O how-to, o compose e o `.env.example` apontam para elas.
- O how-to remete o `tini` para `operacao.md`, e o passo 1 dele encolheu.
- A seção do profile em `comandos.md` virou uma frase com link.
- O comentário do compose não repete o comando sem `-p`.
- Uma frase em `observabilidade.md` sobre os exporters desligados pelo ambiente.

Pulado:

- Derivar o `:run:prod` no `run-scripts.mjs` em vez de um script por módulo: contraria a decisão "Runner de migrations".
- Tirar o `NODE_ENV` do `x-app-env` e o `postgres` do `depends_on` do `app`: os dois estão no "Faça" do passo 4.
- Rodar as migrations em paralelo: ganho de segundos num passo one-shot.
- Trocar o `tsc` pelo SWC: o plugin do Swagger depende do `tsc`.

`/code-review` (high): nenhum bug que bloqueie, quatro `nit`, todos corrigidos:

- A imagem define `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER` e `OTEL_LOGS_EXPORTER` em `none`, para um deploy só com as variáveis obrigatórias não herdar o atraso de ~8 s. A plataforma os sobrescreve quando houver coletor.
- `"deleteOutDir": true` no `nest-cli.json`: sem ele, uma migration apagada ou renomeada no `src/` continuava no `dist/`, e o `:run:prod` local a aplicaria. Conferido: um arquivo solto no `dist/` some no build.
- O how-to diz que o passo de migration roda uma cópia por vez (um Job ou release command por deploy, nunca um initContainer por réplica): o `migration:run` não trava contra execuções simultâneas.
- Rota nova no `AGENTS.md` para o Dockerfile, o `.dockerignore`, o profile `prod` e os scripts `:run:prod`.

Depois das correções, o profile `prod` rodou de novo: 19 migrations, `/health/ready` = 200, `stop` em 0,49 s, saída 143.
