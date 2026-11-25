# Plano de otimização do CI: integração rápida, setup em cache e e2e no CI

O CI leva 1m48s numa run da `main` com a suíte inteira (run `45523642550`, 2026-11-25). O caminho crítico é o job `integration`: 1m39s, dos quais 70,35 s de Vitest. Cada um dos 20 `*.int-spec.ts` sobe os próprios containers no `beforeAll`, em série. Um arquivo de Postgres leva cerca de 2 s entre container e migrations, o primeiro leva 15 s com o download da imagem, e os testes em si somam poucos segundos. O `npm ci` custa de 18 a 33 s em cada um dos 4 jobs. O e2e não roda no CI (issue #14).

O trabalho tem três entregas, cada uma num PR, nesta ordem:

- **Integração:** um Postgres e um Redis por execução, um banco clonado de template por arquivo e os arquivos em paralelo.
- **Setup do CI:** uma composite action com o `node_modules` em cache, reaproveitada pelos jobs.
- **E2E no CI:** um job `e2e` com `services:`, que fecha a issue #14.

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Containers da integração | Um Postgres 19 e um Redis 8 por execução do `test:int`, no `globalSetup` do projeto `int`, com as URLs passadas por `provide`/`inject` |
| Isolamento no Postgres | Um banco por arquivo, clonado com `CREATE DATABASE ... TEMPLATE`. Um template por conjunto de migrations (identity, orders+outbox, inventory, catalog, outbox), para a migration de um módulo continuar sem poder depender do schema de outro. SQL manual, não o `snapshot()` do Testcontainers (ele trata um template só) |
| Rejeitados no Postgres | Schema por arquivo (as migrations criam schemas fixos), rollback por teste (quebra os testes de transação, concorrência e outbox, que abrem conexões próprias) e `TRUNCATE` entre arquivos (obriga a rodar em série) |
| Isolamento no Redis | Um banco lógico por worker (`redis://host:port/<VITEST_POOL_ID>`), limpo com `FLUSHDB` no início de cada arquivo |
| Containers próprios | O `cached-order.queries.int-spec.ts` (derruba o Redis no meio do teste) e o `smtp-email-sender.int-spec.ts` (Mailpit) continuam com o seu |
| Postgres de teste | `fsync=off`, `synchronous_commit=off`, `full_page_writes=off`, dados em tmpfs e `max_connections=200`. Na integração e no service do e2e. O `docker-compose.yml` não muda. A imagem continua `postgres:19`, sem `-alpine` |
| Paralelismo | `fileParallelism: true` no `int`, com o `maxWorkers` padrão. Um teste instável se corrige na espera dele, sem voltar para o modo serial |
| Assinatura dos helpers | `startDatabase` e os `start<Módulo>Database` continuam devolvendo `{ ds, stop }`. Nenhum spec muda por causa do banco |
| Instalação no CI | Composite action `.github/actions/setup`: `setup-node`, `actions/cache` do `node_modules` com chave por SO, versão do Node e hash do `package-lock.json`, e `npm ci` só quando o cache não acerta. Sai se o ganho for menor que 10 s por job |
| E2E no CI | Job `e2e` com `services:` (Postgres, Redis e Mailpit, nas imagens do compose), `npm run db:setup` e `npm run test:e2e`. O fluxo local continua no docker-compose |
| E2E em PR | O mesmo `VITEST_ARGS` dos outros jobs: `--changed HEAD^1 --passWithNoTests` em PR, a suíte inteira na `main` |
| Pular jobs sem teste afetado | Não. O `--changed` decide dentro do job. Pular exigiria `npm ci` no `changes` e somaria uns 20 s ao caminho crítico de todo PR |
| Fora do plano | Sharding, cache das imagens Docker, `withReuse` no CI, e2e com Testcontainers. Os três primeiros com gatilho em `evolucoes-com-gatilho.md` |
| ADR | Nenhum. O porquê do template por módulo fica nas convenções de `docs/reference/testes.md` |

## Metas

Medidas numa run da `main` depois do merge de cada PR, comparadas com a run `45523642550`. Os números de antes e depois vão na descrição do PR.

| Medida | Hoje | Meta | Como medir |
| --- | --- | --- | --- |
| Vitest do `test:int` | 70,35 s | ≤ 30 s | Linha `Duration` do log do step `npm run test:int` |
| Job `integration` | 1m39s | ≤ 1m | `started_at` e `completed_at` do job |
| Step de instalação com o cache acertando | 18 a 33 s | ≤ 10 s | Duração do step de instalação da composite action |
| Job `e2e` | — | ≤ 2 min | `started_at` e `completed_at` do job |
| Workflow inteiro, já com o e2e | 1m48s | ≤ 1m48s | Do primeiro `started_at` ao `completed_at` do `ci` |

Comando para os tempos de uma run:

```sh
gh api repos/{owner}/{repo}/actions/runs/<id>/jobs \
  -q '.jobs[] | {name, started_at, completed_at, steps: [.steps[] | {name, started_at, completed_at}]}'
```

Se o e2e passar de 2 min e virar o caminho crítico, a otimização dele vai para uma issue nova, sem bloquear este plano.

## Referências

| Assunto | Fonte | Tipo |
| --- | --- | --- |
| `globalSetup` com `provide`/`inject` | <https://vitest.dev/config/globalsetup> e <https://node.testcontainers.org/quickstart/global-setup/> | Oficial |
| `CREATE DATABASE ... TEMPLATE`, estratégia `WAL_LOG` padrão desde o PG 15, template sem conexões durante a cópia | <https://www.postgresql.org/docs/current/sql-createdatabase.html> | Oficial |
| Non-durable settings | <https://www.postgresql.org/docs/current/non-durability.html> | Oficial |
| Bancos lógicos do Redis (`SELECT`) | <https://redis.io/docs/latest/commands/select/> | Oficial |
| `--changed` segue `setupFiles`, `globalSetup` e a config | <https://vitest.dev/config/changed> e <https://github.com/vitest-dev/vitest/pull/11432> | Oficial |
| `setup-node` não guarda o `node_modules` | <https://github.com/actions/setup-node> | Oficial |
| Sharding do Vitest | <https://vitest.dev/guide/improving-performance#sharding> | Oficial |
| Required check com job pulado | <https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks> | Oficial |
| Container por execução, template por arquivo, non-durable e tmpfs: arquivos pesados de 139 s/94 s para 48 s/45 s | <https://github.com/mcm/omniralph/pull/71> | PR |
| Clone de template com média de 98,4 ms (p95 de 299,5 ms) | <https://brandur.org/fragments/pgtestdb> | Blog |
| Seed único com rollback por teste: 1401 testes de 10.153 s para 159 s | <https://codepunkt.de/writing/blazing-fast-prisma-and-postgres-tests-in-vitest/> | Blog |

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**. O **Pronto quando** é o critério de aceite: o passo só é marcado quando todos os itens dele forem conferidos.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. As mais usadas aqui: `docs/reference/testes.md`, `docs/reference/comandos.md`, `docs/reference/evolucoes-com-gatilho.md` e `docs/explanation/redis.md`.
- Antes de usar uma API nova (`provide`/`inject`, `globalSetup` por projeto, `VITEST_POOL_ID`, `withTmpFs`, `actions/cache`, `services:` do GitHub Actions), consulte o Context7, como pede o `AGENTS.md`. Sem a biblioteca lá, use a documentação oficial e diga isso no **Como ficou**.
- Uma fase só termina com `npm run ci`, `npm run test:int` e `npm run test:e2e` passando, e depois de `/simplify` e `/code-review` sobre as mudanças dela (fluxo de entrega do `AGENTS.md`).
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Push, abertura de PR e mudança de configuração do repositório no GitHub só com o ok do dono do repositório.
- Quando todas as fases estiverem ✅, apague este arquivo, tire a rota "Continuar um plano em andamento" do `AGENTS.md` e atualize a linha de planos do `docs/README.md`. O registro fica no histórico do git.

## Mapa

| Fase | O que entrega | Issue | Status |
| --- | --- | --- | --- |
| 1. Integração | `globalSetup` com Postgres e Redis compartilhados, banco por arquivo clonado de template, arquivos em paralelo | #27 | ✅ |
| 2. Setup do CI | Composite action com `node_modules` em cache nos jobs | #28 | ✅ |
| 3. E2E no CI | Job `e2e` com `services:`, no `needs` do `ci` | #14 | 🟡 |

A ordem importa: cada fase mede o próprio ganho sem misturar efeitos, a fase 2 prova se o cache cumpre o critério de reversão, e o job e2e já nasce com o setup rápido.

---

## Fase 1: Integração

> **Status:** ✅ Concluída · **Início:** 2026-11-24 · **Conclusão:** 2026-11-24
>
> - [x] Passo 1: `globalSetup` com Postgres, templates e Redis
> - [x] Passo 2: helpers clonam o template e usam o banco lógico do worker
> - [x] Passo 3: arquivos em paralelo
> - [x] Passo 4: documentação e medição

### Passo 1: `globalSetup` com Postgres, templates e Redis

**Por quê:** subir um container por arquivo custa cerca de 2 s em cada um dos 20 arquivos, em série. Um container por execução paga isso uma vez. As migrations rodam uma vez por template, e cada arquivo ganha uma cópia barata do banco já migrado.

**Faça:**

- `test/global-setup/int.ts` (ou nome equivalente em `test/`), registrado no `globalSetup` do projeto `int` no `vitest.config.ts`. Ele:
  - sobe `postgres:19` com `-c fsync=off -c synchronous_commit=off -c full_page_writes=off -c max_connections=200` e o diretório de dados em tmpfs (`/var/lib/postgresql`, onde a imagem 18+ guarda o `PGDATA`);
  - para cada conjunto de migrations, cria um banco `tpl_<conjunto>` (identity, orders, inventory, catalog, outbox), aplica as migrations com um `DataSource` do TypeORM e o fecha. O template não pode ter conexões abertas na hora da cópia;
  - sobe `redis:8` com `--maxmemory-policy noeviction`, como o `startRedis` faz hoje;
  - publica com `provide` a URL do Postgres (sem banco) e a do Redis (sem índice), e declara os tipos com `declare module 'vitest' { interface ProvidedContext { ... } }`;
  - no teardown, para os dois containers.
- As listas de entidades e migrations de cada conjunto saem dos `test/helpers/<módulo>-database.ts`, sem duplicação: o helper exporta a lista, e o `globalSetup` e o helper a usam.
- Os containers sobem em paralelo (`Promise.all`), e os templates são montados em paralelo depois do Postgres pronto.

**Pronto quando:**

- `npm run test:int` sobe exatamente um Postgres e um Redis para os arquivos compartilhados, mais os containers próprios do `cached-order.queries` e do `smtp-email-sender`. Conferido com `docker ps` durante a execução ou com o log do Testcontainers (`DEBUG=testcontainers*`).
- Com o `globalSetup` falhando (por exemplo, uma migration quebrada), a execução para com o erro da migration, sem esperar o timeout de cada arquivo.
- `npm run typecheck` aceita `inject('...')` com o tipo declarado.

**Como ficou:** `test/global-setup/int.ts`. Os conjuntos não vêm de uma lista: o `globalSetup` acha os `test/helpers/*-database.ts` por `import.meta.glob`, e cada um exporta um `ModuleDatabase` (`template`, entidades, migrations e tabela de migrations). Assim o `plop module` (template `test-database.hbs` atualizado) não precisa registrar nada, e remover um módulo de exemplo não deixa import quebrado; conferido gerando um módulo num worktree descartável. O Vitest carrega o `globalSetup` no processo principal, num ambiente do Vite que não recebia o `ssr.resolve.conditions`: as migrations vinham do `dist/`, sem erro. O `vitest.config.ts` ganhou um plugin com `configEnvironment` que aplica a condição `@app/source` a todo ambiente do Node. Conferido: `docker ps` durante a execução mostrou um `postgres:19`, dois `redis:8` (o compartilhado e o do `cached-order.queries`) e os dois Mailpit do `smtp-email-sender`; com uma migration quebrada, a execução para em uns 5 s com o erro dela. Context7 consultado para `provide`/`inject`, `globalSetup` e `withTmpFs`.

### Passo 2: helpers clonam o template e usam o banco lógico do worker

**Por quê:** a mudança fica nos helpers, para nenhum spec ter que saber se o container é compartilhado.

**Faça:**

- `startDatabase` recebe o nome do template (em vez de entidades e migrations soltas), cria `CREATE DATABASE "<conjunto>_<id único>" TEMPLATE "tpl_<conjunto>"`, abre o `DataSource` nele e devolve `{ ds, stop }`. O `stop` fecha o `DataSource` e faz `DROP DATABASE ... WITH (FORCE)`. O id único combina o `VITEST_POOL_ID` com um contador ou um `randomUUID()` curto.
- `startOrdersDatabase`, `startIdentityDatabase`, `startInventoryDatabase`, `startCatalogDatabase` e `startOutboxDatabase` mantêm o nome e o retorno.
- `startRedis()` passa a devolver a URL `redis://host:port/<VITEST_POOL_ID % 16>` do Redis compartilhado, depois de um `FLUSHDB` nesse banco. Os specs que usam `redis.getConnectionUrl()` passam a usar a URL devolvida. O `flushall` do `redis-throttler-storage.int-spec.ts` vira `flushdb`.
- `startDedicatedRedis()` mantém o comportamento de hoje (um container próprio) e passa a ser usado só pelo `cached-order.queries.int-spec.ts`, que faz `redis.stop()` no meio do teste.
- O `smtp-email-sender.int-spec.ts` não muda.

**Pronto quando:**

- Os 20 arquivos passam com `npm run test:int`, ainda em série (`fileParallelism: false`), sem mudança nos `it(...)`.
- Depois da execução, o Postgres compartilhado não tem bancos de teste sobrando: um `afterAll` que falha antes do `stop` não deixa lixo que afete outra execução, porque o container é descartado no teardown.
- Uma migration nova num módulo, sem entrar no helper do módulo, não é aplicada no template, o mesmo comportamento de hoje (ver a linha "lista única de migrations" em `evolucoes-com-gatilho.md`).
- `npm run ci` passa.

**Como ficou:** o `startDatabase` recebe o `ModuleDatabase` inteiro (precisa das entidades além do nome do template). O banco de cada arquivo se chama `<template>_<VITEST_POOL_ID>_<8 hex>`; os comandos de administração usam um `DataSource` de uma conexão no banco `postgres`, sem dependência nova (o projeto não tem `@types/pg`). O `startDedicatedRedis` virou `startRedisContainer`, usado também pelo `globalSetup`. O Redis sobe com `--databases 128` e o `startRedis` usa o `VITEST_POOL_ID` direto, sem o `% 16`: o `/code-review` mostrou que, com 18 threads ou mais, o Vitest abre mais de 16 workers e dois cairiam no mesmo banco (decisão aceita pelo dono). Os 20 arquivos passaram em série em 31,6 s (antes, 70 s no CI); no teardown, só os templates sobravam no Postgres.

### Passo 3: arquivos em paralelo

**Por quê:** com banco e Redis isolados por arquivo e por worker, a única razão do `fileParallelism: false` (timeouts com vários containers subindo) deixa de existir.

**Faça:**

- No projeto `int` do `vitest.config.ts`: `fileParallelism: true` (ou remover a linha), `hookTimeout` de 120 s para 30 s. Atualize o comentário.
- Rode a suíte inteira 5 vezes seguidas localmente (`for i in $(seq 5); do npm run test:int || break; done`). Um teste que falhar só em paralelo se corrige na espera (`waitFor` com prazo em vez de `sleep`, ou prazo maior no `waitFor`), sem voltar para o modo serial.
- Acrescente o arquivo do `globalSetup` e os helpers que ele importa ao `forceRerunTriggers` se o Vitest 5.1 não os tratar como gatilho. Confira: numa branch que muda só o `globalSetup`, `npx vitest run --project int --changed main` roda os 20 arquivos.

**Pronto quando:**

- 5 execuções locais seguidas de `npm run test:int` passam.
- Mudar só o arquivo do `globalSetup` seleciona os 20 arquivos com `--changed`.
- Mudar só `src/modules/catalog/typeorm-catalog.facade.ts` seleciona só o `typeorm-catalog.facade.int-spec.ts`, como hoje.
- `npm run ci` passa.

**Como ficou:** além do `hookTimeout`, saíram os prazos de 120 s e 180 s dos `beforeAll` e `afterAll` dos specs que não sobem mais container (e do template `typeorm.repository.int-spec.hbs`); ficaram só no `cached-order.queries` e no `smtp-email-sender`. O `forceRerunTriggers` não precisou mudar: conferido com commits num worktree descartável, mudar o `globalSetup` ou o `test/helpers/database.ts` seleciona os 20 arquivos, e mudar só a facade do catalog seleciona só o spec dela. Localmente, com 4 threads, a suíte levou de 13 a 18 s com a máquina livre e de 23 a 48 s com o docker-compose no ar, com pico de 12 conexões no Postgres. Cinco execuções seguidas passaram. Em cerca de 25 execuções anteriores, 3 falharam no `globalSetup` com "Port ... not bound after 120000ms": no Docker Desktop com WSL, a porta que o Docker escolhe para o container às vezes coincide com uma porta efêmera em `TIME-WAIT` no WSL (conferido com `ss`), e a porta não abre. É do ambiente local, não dos testes, e não acontece no runner do CI, que usa Docker nativo.

### Passo 4: documentação e medição

**Por quê:** a convenção "Um container por arquivo de integração" de `testes.md` deixa de valer, e o gatilho que pedia esta mudança em `evolucoes-com-gatilho.md` foi cumprido.

**Faça:**

- `docs/reference/testes.md`, seção **Convenções**: troque "Um container por arquivo de integração" pela regra nova (container por execução, banco clonado de template por arquivo, banco lógico do Redis por worker, as duas exceções com container próprio). Inclua o porquê do template por módulo e por que não usamos rollback nem `TRUNCATE`. Atualize a linha dos helpers, se ela citar `startDatabase` ou `startRedis`.
- `docs/reference/evolucoes-com-gatilho.md`, seção **CI**: tire a linha "O job `integration` passar de uns 5 minutos..." (feita) e acrescente:
  - sharding (`--shard` + `--merge-reports`), com o gatilho "o Vitest de um job passar de 2 min na `main`";
  - cache das imagens Docker, com o gatilho "o pull das imagens passar de 15 s no job".
- `AGENTS.md`: confira se a frase "`npm run test:int` sobe Postgres e Redis descartáveis pelo Testcontainers" continua certa (continua: um de cada por execução).
- Depois do merge, meça a primeira run da `main` com o comando da seção **Metas** e registre os números no **Como ficou** e no PR.

**Pronto quando:**

- `npm run ci` passa, incluindo o `docs:check`.
- Na primeira run da `main` depois do merge: Vitest do `test:int` ≤ 30 s e job `integration` ≤ 1m.
- A issue #27 está fechada pelo PR.

**Como ficou:** além das páginas do "Faça", mudaram `comandos.md` (descrição do `test:int`) e `gerar-uma-migration.md` (os testes montam o template do módulo). A frase do `AGENTS.md` continua certa. Primeira run da `main` depois do merge do PR #30 (run `45533732641`): Vitest do `test:int` em 21,87 s com os 20 arquivos (antes, 70,35 s), job `integration` em 48 s (antes, 1m39s) e workflow inteiro em 57 s (antes, 1m48s). Números também na descrição do PR. A #27 fechou com o merge.

---

## Fase 2: Setup do CI

> **Status:** ✅ Concluída · **Início:** 2026-11-24 · **Conclusão:** 2026-11-25
>
> - [x] Passo 5: composite action com o `node_modules` em cache
> - [x] Passo 6: documentação e medição

### Passo 5: composite action com o `node_modules` em cache

**Por quê:** o `cache: npm` do `setup-node` guarda só o `~/.npm`. A instalação e a extração do `npm ci` rodam em todo job, de 18 a 33 s cada. Os três passos de setup (checkout, setup-node e npm ci) se repetem em 4 jobs, e o e2e seria o quinto.

**Faça:**

- `.github/actions/setup/action.yml` (composite), com as entradas `node-version` e `node-version-file`:
  - `actions/setup-node` sem `cache: npm` (o `~/.npm` não serve quando o `node_modules` vem do cache) ou com ele, o que medir melhor. Registre a escolha no **Como ficou**;
  - `actions/cache` do `node_modules` com a chave `node-modules-${{ runner.os }}-<versão do Node resolvida>-${{ hashFiles('package-lock.json') }}`, sem `restore-keys` (um `node_modules` de outro lockfile não serve);
  - `npm ci` só quando `cache-hit != 'true'`.
- A versão do Node entra na chave pelo valor resolvido (`node --version` ou a saída `node-version` do `setup-node`), não pela entrada, para o `.nvmrc` e a matriz caírem na mesma regra.
- Os jobs `check`, `unit` e `integration` trocam os passos `setup-node` e `npm ci` pela action. O checkout fica no job, porque a action local só existe depois dele.
- Versões das actions: a estável mais recente, conferida na documentação oficial, fixada pela tag maior.

**Pronto quando:**

- O workflow passa no `actionlint` (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest`).
- Numa segunda run do mesmo lockfile, o step de cache mostra acerto, e o `npm ci` aparece como pulado em todos os jobs.
- Mudar o `package-lock.json` gera cache novo, e os testes passam com ele.
- `npm run ci` passa.

**Como ficou:** `.github/actions/setup/action.yml` com `actions/setup-node@v7` e `actions/cache@v6`, versões conferidas nos releases e a API do `cache-hit` no Context7. Sem `cache: npm`: com o `node_modules` em cache, restaurar o `~/.npm` em todo job só custaria tempo; ele serviria só na troca de lockfile, que já paga o `npm ci` inteiro. A chave usa a saída `node-version` do `setup-node`. Conferido no PR #31: a primeira run criou um cache por versão do Node (`v22.22.3` e `v24.22.3`, 56 MiB cada), com o setup em 20 a 30 s por job; no re-run, o cache acertou nos 4 jobs, o `npm ci` saiu como `skipped` e o setup levou de 4 a 8 s. Um commit temporário que mudou o `package-lock.json` gerou chave nova, `npm ci` nos 4 jobs, cache salvo e testes verdes; o commit foi revertido no mesmo PR.

### Passo 6: documentação e medição

**Faça:**

- `docs/reference/comandos.md`, seção **CI**: uma linha sobre a composite action e a chave do cache.
- Meça a instalação com o cache acertando em 3 runs. Se a média de ganho por job ficar abaixo de 10 s, reverta a fase (volte ao `npm ci` com `cache: npm`) e registre o número no **Como ficou** e em `evolucoes-com-gatilho.md`.

**Pronto quando:**

- Step de instalação com o cache acertando ≤ 10 s na `main`, ou a fase revertida com o número registrado.
- A issue #28 está fechada pelo PR.

**Como ficou:** a linha do `comandos.md` entrou no PR #31. Medido na run `45537114583` da `main`: a tentativa 1 criou o cache da `main` (o cache do PR não vale nela, é isolado por branch), com setup de 16 a 30 s por job. Nas tentativas 2 a 4, com o cache acertando, o setup inteiro levou de 3 a 9 s por job, média de 5,9 s, contra 18 a 33 s do `npm ci` de antes: ganho de 12 a 27 s por job, acima do critério de 10 s, e a fase fica. O job `integration` levou de 29 a 38 s e o workflow de 38 a 49 s. Números também na descrição do PR. A #28 fechou com o merge.

---

## Fase 3: E2E no CI

> **Status:** 🟡 Em andamento · **Início:** 2026-11-25 · **Conclusão:** —
>
> - [ ] Passo 7: job `e2e` com `services:`
> - [ ] Passo 8: documentação e medição

### Passo 7: job `e2e` com `services:`

**Por quê:** os fluxos de ponta a ponta (login, throttle, outbox, primeiro pedido) só rodam quando alguém lembra de rodar `npm run test:e2e`. Os `services:` sobem antes dos steps e ficam prontos durante o checkout e a instalação, então quase não custam tempo de relógio.

**Faça:**

- Job `e2e` no `.github/workflows/ci.yml`, com `needs: changes` e `if: needs.changes.outputs.code == 'true'`, como o `integration`, e `checkout` com `fetch-depth: 2`.
- `services:` com as imagens do `docker-compose.yml` (`postgres:19`, `redis:8`, `axllent/mailpit:v1`), as portas que o `test/setup-env.ts` espera (5432, 6379, 1025 e 8025) e healthcheck em `options:` (`pg_isready`, `redis-cli ping`, `/mailpit readyz`), com intervalo curto (por exemplo, `--health-interval 2s --health-retries 30`).
- Os `services:` não aceitam `command` (confira na documentação atual do GitHub Actions; se passarem a aceitar, use-o no lugar dos steps abaixo). Por isso:
  - o tmpfs do Postgres vai em `options: --tmpfs /var/lib/postgresql`;
  - `fsync`, `synchronous_commit` e `full_page_writes` entram por um step com `ALTER SYSTEM SET ...` e `SELECT pg_reload_conf()` (os três aceitam reload sem restart; confira na documentação do Postgres);
  - o `--maxmemory-policy noeviction` do Redis entra por um step com `CONFIG SET maxmemory-policy noeviction` (via `docker exec ${{ job.services.redis.id }} redis-cli ...`).
- Steps: checkout, a composite action da fase 2, os ajustes acima, `npm run db:setup`, `npm run test:e2e -- ${{ env.VITEST_ARGS }}`.
- `e2e` entra no `needs` do job `ci`. O nome do check obrigatório não muda, então o ruleset do `scripts/setup-github.mjs` não muda.
- `vitest.config.ts`: `**/scripts/run-scripts.mjs` no `forceRerunTriggers`, com um comentário (o `db:setup` aplica as migrations por ele, sem import).

**Pronto quando:**

- O workflow passa no `actionlint`.
- O job passa num PR que muda código em `src/`.
- Num commit descartável que quebra um e2e (por exemplo, inverter um `expect` em `health.e2e-spec.ts`), o job `e2e` falha e o `ci` falha. O commit sai do PR antes do merge.
- Num PR só de `.md`, o `e2e` aparece como pulado e o `ci` passa.
- Num PR que muda só um `*.spec.ts` unitário, o `e2e` termina com "No affected test files found" e código 0.
- `npm run ci` passa.

**Como ficou:** o GitHub Actions passou a aceitar `command` em `services:` (documentação atual, pelo Context7): os parâmetros do Postgres e o `noeviction` do Redis vão nele, sem os steps de `ALTER SYSTEM` e `CONFIG SET`. O actionlint 1.7.12 ainda não conhece a chave; `.github/actionlint.yaml` ignora só esse erro. O job ganhou um step `cp .env.example .env`, fora do "Faça": os data sources do `db:setup` validam o ambiente, e a primeira run falhou sem ele. Os `services:` não sobem durante a instalação, como o "Por quê" supunha: o "Initialize containers" leva uns 15 s antes do primeiro step. Conferido no PR #32: o job passou com os 10 arquivos (Vitest em 70 s, job em 1m39s a 1m45s); um commit descartável com `expect(418)` no `health.e2e-spec.ts` fez o `e2e` e o `ci` falharem, e foi revertido. Falta conferir, depois do merge, o PR só de `.md` (`e2e` pulado) e o PR que muda só um unitário ("No affected test files found"): este PR muda o `vitest.config.ts` e o workflow, que estão no `forceRerunTriggers`, então roda a suíte inteira.

### Passo 8: documentação e medição

**Faça:**

- `docs/reference/comandos.md`, seção **CI**: linha do `e2e` na tabela dos jobs. Tire o e2e do item "Fora do CI". O "PR só de Markdown" passa a citar o `e2e` junto do `unit` e do `integration`.
- `docs/reference/testes.md`: a seção "Só os testes afetados" passa a citar o e2e. Diga que, como todo e2e importa o `AppModule`, quase toda mudança em `src/` roda a suíte e2e inteira.
- `docs/reference/evolucoes-com-gatilho.md`, seção **CI**: e2e com Testcontainers num `globalSetup`, com o gatilho "um e2e falhar localmente por estado do docker-compose ou por um `start:dev` esquecido".
- Depois do merge, meça a primeira run da `main`.

**Pronto quando:**

- `npm run ci` passa, incluindo o `docs:check`.
- Na primeira run da `main` depois do merge: job `e2e` ≤ 2 min e workflow inteiro ≤ 1m48s. Se o `e2e` passar de 2 min, abra uma issue para otimizá-lo e registre o número aqui.
- A issue #14 está fechada pelo PR.
