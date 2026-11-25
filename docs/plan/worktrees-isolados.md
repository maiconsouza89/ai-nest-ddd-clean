# Plano dos ambientes isolados por git worktree

O ambiente de desenvolvimento comporta um checkout por vez (issue #35). Dois `git worktree` em paralelo batem nas portas fixas do `docker-compose.yml`. Se apontam para o mesmo Postgres e o mesmo Redis, as migrations de uma branch quebram a outra, e uma instância consome as filas do BullMQ, os jobs agendados e o rate limit da outra. Os e-mails se misturam no Mailpit.

Isso já aconteceu durante a pesquisa deste plano: um `start:dev` no checkout principal rodou ao mesmo tempo que um `test:e2e` num worktree do herdr, os dois no mesmo Redis e no mesmo Postgres.

Os worktrees nascem de três jeitos: pelo herdr (`git worktree add` puro, em `~/.herdr/worktrees/<repo>/<branch>`), pelo `claude --worktree` (em `.claude/worktrees/<nome>`) e à mão. O desenho precisa servir aos três.

O trabalho é um PR só, em três fases. O guard, o script, o `test/setup-env.ts` e as docs dependem uns dos outros. Um PR só com o guard bloquearia worktrees sem oferecer o setup, e um só com o script deixaria o e2e apontando para o principal.

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Stack | Um Postgres, um Redis e um Mailpit **compartilhados**: os do projeto do Compose do checkout principal (`ddd-clean-nest`), nas portas de sempre. Nenhum container novo por worktree |
| Identidade do worktree | Um **slot** `N` de 1 a 15, gravado como `WORKTREE_SLOT` no `.env` do worktree. O checkout principal é o slot 0 e não tem a variável. O teto vem dos 16 bancos lógicos do Redis |
| O que o slot define | API em `3000 + N`, banco `app_wt<N>`, banco lógico `N` do Redis, tag `wt<N>` no Mailpit e `deployment.environment.name=wt<N>` nos traces |
| Escolha do slot | O menor `N` que nenhum worktree da lista do `git worktree list --porcelain` reservou (lido do `.env` de cada um) e cuja porta `3000 + N` esteja livre. Um worktree removido libera o slot sozinho |
| Reaproveitar um slot | Na **primeira reserva**, o setup zera o que um worktree antigo deixou: `DROP DATABASE IF EXISTS app_wt<N>`, `FLUSHDB` no banco `N` e o `DELETE` das mensagens com a tag. Com o slot já gravado, rodar o setup de novo mantém os dados |
| Postgres | Um banco vazio por worktree, criado pelo setup e migrado pelo `db:setup` da própria branch. Banco, não schema: os módulos já usam schemas próprios. Não se clona o `app`: o `CREATE DATABASE … TEMPLATE` falha com qualquer conexão aberta nele e traria o schema de outra branch |
| Redis | Banco lógico na URL (`redis://localhost:6379/<N>`). Nenhuma mudança na app: o BullMQ, o throttler, o cache e o health leem o mesmo `REDIS_URL`, e o ioredis e o node-redis aceitam `/N`. Sem prefixo de chave na app |
| Mailpit | Compartilhado, com uma tag por worktree pelo usuário SMTP: `SMTP_URL=smtp://wt<N>:x@127.0.0.1:1025`, e o Mailpit com `--smtp-auth-accept-any --smtp-auth-allow-insecure --tags-username`. Se o passo 1 mostrar que o checkout principal deixa de enviar sem autenticação, cai para o Mailpit sem tags: o e2e já usa endereços únicos |
| `max_connections` | 200 no Postgres do compose: cada worktree soma até uns 20 a 25 conexões no pico (`DATABASE_POOL_MAX=10` no `start:dev` e no e2e, mais migration ou seed) |
| Projeto do Compose | O `.env` do worktree recebe `COMPOSE_PROJECT_NAME` com o nome do projeto do principal. Um `docker compose up -d` num worktree mira o stack compartilhado e não faz nada se ele já estiver no ar |
| Arquivos de env | O setup **gera o `.env`** do worktree: cópia do `.env` do principal, com `PORT`, `DATABASE_URL`, `REDIS_URL` e `SMTP_URL` reescritas no lugar, e as chaves que faltam num bloco final marcado `# gerado pelo worktree:setup`. O `.env.local` do principal é copiado **sem as chaves do worktree**, com um aviso das que saíram |
| Traces | `deployment.environment.name=wt<N>` acrescentado ao `OTEL_RESOURCE_ATTRIBUTES`, sem sobrescrever o que já houver. O `OTEL_SERVICE_NAME` não muda |
| E2E | O `test/setup-env.ts` lê do `.env.local` e do `.env` (pela ordem do `ENV_FILES`, com o ambiente vencendo) só `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`, `MAILPIT_API_URL` e `MAILPIT_TAG`. Com `MAILPIT_TAG`, o `test/helpers/mailpit.ts` busca por `tag:wt<N> to:"…"`. O resto continua com os valores de teste |
| E2E dentro de um checkout | Continua serial (`fileParallelism: false`) e no banco do checkout. A armadilha do `start:dev` passa a valer por checkout, não entre worktrees |
| Comandos | `npm run worktree:setup` e `npm run worktree:down`, em `scripts/worktree.mjs` (Node puro, como o `run-scripts.mjs`), com a lógica pura num módulo próprio, coberta por unitários |
| `worktree:down` | Apaga só os dados do slot (banco, banco lógico do Redis e mensagens da tag). Nunca roda `docker compose down` nem toca em containers e volumes. O `git worktree remove` continua manual |
| Trava | `scripts/worktree-guard.mjs` nos pre-scripts de `start:dev`, `test:e2e`, `db:setup` e `db:seed`: num worktree linkado (o `.git` da raiz é um arquivo) sem `WORKTREE_SLOT`, falha com "rode `npm run worktree:setup`". No principal e no CI, não faz nada |
| Integração com o Claude Code | Nenhuma. Sem hook `WorktreeCreate`: ele só cobre o Claude Code, substitui a criação pelo git e reservaria um slot por subagente com `isolation: worktree`, sem `WorktreeRemove` para devolvê-lo. Sem `.worktreeinclude`: copiaria o `.env` do principal com o banco `app`. Sem `post-checkout` do git: dispara também no `git clone` |
| Profile `prod` | Só no checkout principal. Num worktree, ele recriaria o `migrate` e o `app` do projeto do principal com o código da branch, e aplicaria as migrations dela no banco `app` |
| Rejeitados | Stack por worktree (escolha do dono). Prefixo de chave na app (mexe em quatro pontos do `src/shared` por um problema só de desenvolvimento). Porta efêmera do Docker (muda a cada `start`, testado no Docker 28.5). Hash do nome para o slot (colide com 15 valores). Pool menor só nos worktrees (o pool ficaria diferente do principal e do CI) |
| ADR | 0011, "Worktrees compartilham o stack do checkout principal, isolados por slot", no passo 9 |
| Glossário | Nada. "Slot" é termo de ferramenta de desenvolvimento, não do domínio nem dos módulos |

## Medições

Medidas numa máquina de 4 núcleos e 10 GB, com o compose no ar, em 2026-11-25. Servem de base para o custo do desenho e para o **Como ficou** do passo 8.

| Medida | Valor |
| --- | --- |
| Postgres 19 ocioso (`docker stats`) | ~45 MiB |
| Redis 8 | ~22 MiB |
| Mailpit 1 | ~33 MiB |
| `start:dev` (`nest start --watch` + `dist/main`) | ~900 MiB de RSS, 32 s até `/health/live` responder |
| Banco vazio no Postgres (`template1`) | ~8 MB de disco |
| Conexão ociosa no Postgres | ~1,5 MB ([AWS](https://aws.amazon.com/blogs/database/resources-consumed-by-idle-postgresql-connections)) |

Com o stack compartilhado, um worktree a mais custa o `start:dev` dele, um banco e um banco lógico do Redis. Nenhum container novo.

## Referências

Consultadas em 2026-11-25.

| Assunto | Fonte | Tipo |
| --- | --- | --- |
| Precedência do nome do projeto (`-p` > `COMPOSE_PROJECT_NAME` > `name:` > pasta) e normalização | <https://docs.docker.com/compose/how-tos/project-name/> e <https://github.com/compose-spec/compose-go/blob/v2.17.0/loader/loader.go#L877-L882> | Oficial |
| `-p` e `COMPOSE_PROJECT_NAME` interpolado: corrigido em 2024 | <https://github.com/docker/compose/issues/11734> e <https://github.com/compose-spec/compose-go/pull/628> | Oficial |
| Interpolação, `.env`, `--env-file` e `COMPOSE_ENV_FILES` | <https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/> e <https://docs.docker.com/compose/how-tos/environment-variables/envvars/> | Oficial |
| `COMPOSE_*` lidas do `.env`, menos o `COMPOSE_ENV_FILES` | <https://github.com/docker/compose/blob/v5.8.0/cmd/compose/compose.go#L788-L829> | Oficial |
| Worktrees do Claude Code e `.worktreeinclude` | <https://code.claude.com/docs/en/worktrees> | Oficial |
| Hooks `WorktreeCreate` e `WorktreeRemove` | <https://code.claude.com/docs/en/hooks#worktreecreate> | Oficial |
| `post-checkout` no `git worktree add`, sem hook de remoção | <https://github.com/git/git/blob/master/Documentation/githooks.adoc> | Oficial |
| `--git-common-dir` e o formato porcelain do `git worktree list` | <https://github.com/git/git/blob/master/Documentation/git-rev-parse.adoc> e <https://github.com/git/git/blob/master/Documentation/git-worktree.adoc> | Oficial |
| Bancos lógicos do Redis, `databases 16`, Cluster só com o banco 0 | <https://redis.io/docs/latest/commands/select/> | Oficial |
| `prefix` do BullMQ e o `keyPrefix` do ioredis incompatível | <https://docs.bullmq.io/guide/connections> | Oficial |
| URL com `/db` no node-redis | <https://github.com/redis/node-redis/blob/master/docs/client-configuration.md> | Oficial |
| `CREATE DATABASE`, `WAL_LOG` e template sem conexões | <https://www.postgresql.org/docs/current/sql-createdatabase.html> | Oficial |
| Opções do Mailpit (`--tags-username`, `--smtp-auth-accept-any`, `--max`) | <https://mailpit.axllent.org/docs/configuration/runtime-options/> | Oficial |
| Tags e filtros de busca do Mailpit | <https://mailpit.axllent.org/docs/usage/tagging/> e <https://mailpit.axllent.org/docs/usage/search-filters/> | Oficial |
| Convenções semânticas de ambiente (`deployment.environment.name`) | <https://opentelemetry.io/docs/specs/semconv/resource/deployment-environment/> | Oficial |
| Portas por worktree com porta efêmera, md5 do caminho ou offset pelo nome | <https://zenn.dev/tokium_dev/articles/git-worktree-dynamic-port-parallel-dev> | Blog |
| Offset por md5 e um compose compartilhado | <https://dev.to/augusto_chirico/claude-code-loves-worktrees-your-infrastructure-doesnt-kfi> | Blog |

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**. O **Pronto quando** é o critério de aceite: o passo só é marcado quando todos os itens dele forem conferidos.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. As mais usadas aqui: `docs/reference/comandos.md`, `docs/reference/variaveis-de-ambiente.md`, `docs/how-to/adicionar-uma-variavel-de-ambiente.md`, `docs/reference/testes.md` e `docs/explanation/redis.md`.
- Antes de usar uma API que o repositório ainda não usa (opções do Mailpit, `DELETE /api/v1/search`, `dotenv.parse`), consulte o Context7, como pede o `AGENTS.md`. Sem a biblioteca lá, use a documentação oficial e diga isso no **Como ficou**.
- Nunca rode `docker compose down -v` num worktree depois do passo 3: o `.env` dele aponta para o projeto do principal, e o comando apaga os dados de todos.
- Uma fase só termina com `npm run ci` passando, e depois de `/simplify` e `/code-review` sobre as mudanças dela (fluxo de entrega do `AGENTS.md`). A fase 2 também pede o `npm run test:e2e`.
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Push, abertura de PR e mudança de configuração do repositório no GitHub só com o ok do dono do repositório.
- O PR que implementa o plano apaga este arquivo, tira a rota "Continuar um plano em andamento" do `AGENTS.md` e atualiza a linha de planos do `docs/README.md`. O registro vai num comentário da issue #35, porque o squash descarta os commits da branch.

## Mapa

| Fase | O que entrega | Status |
| --- | --- | --- |
| 1. Ambiente do worktree | `worktree:setup`, `worktree:down`, o guard e o compose ajustado | ⬜ |
| 2. E2E por worktree | O e2e lê o env do checkout e filtra o Mailpit pela tag. Aceite da issue | ⬜ |
| 3. Documentação | ADR 0011, how-to, referências, AGENTS.md | ⬜ |

A ordem importa: a fase 2 só se testa com worktrees montados pela fase 1, e a fase 3 descreve o que as duas entregaram.

---

## Fase 1: Ambiente do worktree

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: verificar a tag do Mailpit pelo usuário SMTP
> - [ ] Passo 2: compose com `max_connections` e as flags do Mailpit
> - [ ] Passo 3: `worktree:setup`
> - [ ] Passo 4: `worktree:down`
> - [ ] Passo 5: guard nos pre-scripts

### Passo 1: verificar a tag do Mailpit pelo usuário SMTP

**Por quê:** a tag por worktree depende de duas coisas que a documentação não garante. Com `--smtp-auth-accept-any`, o Mailpit precisa continuar aceitando envio sem autenticação, que é o do checkout principal e o do CI. E o nodemailer precisa autenticar sem TLS. Se uma das duas falhar, o desenho cai para o Mailpit sem tags, e os passos 3, 4 e 7 mudam.

**Faça:**

- Consulte as opções atuais no Context7 ou em <https://mailpit.axllent.org/docs/configuration/runtime-options/>: os nomes das flags e das variáveis `MP_*` equivalentes.
- Num container descartável (`docker run --rm -p 127.0.0.1:2025:1025 -p 127.0.0.1:9025:8025 axllent/mailpit:v1 --smtp-auth-accept-any --smtp-auth-allow-insecure --tags-username`), envie três e-mails com o nodemailer da app:
  - sem usuário (`smtp://127.0.0.1:2025`);
  - com `smtp://wt1:x@127.0.0.1:2025`;
  - com `smtp://wt2:x@127.0.0.1:2025`.
- Confira pela API (`/api/v1/search?query=tag:wt1`) que cada tag traz só o seu e-mail, e que o primeiro chegou sem tag.
- Confira o `DELETE /api/v1/search?query=tag:wt1`: apaga só as mensagens de `wt1`.
- Remova o container descartável.

**Pronto quando:**

- Os três envios chegaram, com as tags certas, e o `DELETE` por tag apagou só as mensagens dela. **Ou** um deles falhou, a decisão "Mailpit" da tabela foi trocada pela opção sem tags com o ok do dono, e os passos 3, 4 e 7 foram ajustados.
- O **Como ficou** registra a versão do Mailpit testada e os nomes exatos das flags.

### Passo 2: compose com `max_connections` e as flags do Mailpit

**Por quê:** o Postgres compartilhado recebe as conexões de todos os worktrees, e o Mailpit precisa das flags do passo 1 para marcar as tags.

**Faça:**

- `docker-compose.yml`, serviço `postgres`: `command: ['postgres', '-c', 'max_connections=200']`, com um comentário de uma linha (os worktrees compartilham este Postgres; ver o how-to do passo 10).
- Serviço `mailpit`: as flags do passo 1, por `command` ou pelas variáveis `MP_*`, o que o passo 1 mostrar mais simples. Comentário com o porquê.
- O comentário do serviço `app` (profile `prod`), que fala da porta 3000 compartilhada com o `start:dev`, continua certo. Acrescente que o profile só roda no checkout principal.
- Não mude as portas nem os volumes: o checkout único continua igual.

**Pronto quando:**

- No checkout principal, `docker compose up -d --wait postgres redis mailpit` recria o Postgres e o Mailpit, e os dados do volume continuam lá (o `app` ainda tem as tabelas e os usuários do seed).
- `SHOW max_connections` devolve 200.
- `npm run test:e2e` passa no checkout principal, sem `.env` novo.

### Passo 3: `worktree:setup`

**Por quê:** é o único caminho para um worktree ganhar ambiente próprio, igual para o herdr, para o Claude Code e para o `git worktree add` à mão.

**Faça:**

- `scripts/worktree.mjs`, com os subcomandos `setup` e `down`, e no `package.json` os scripts `worktree:setup` (`node scripts/worktree.mjs setup`) e `worktree:down`.
- A lógica pura vai num módulo à parte (por exemplo, `scripts/worktree-env.mjs`): escolha do slot, reescrita do `.env`, filtro do `.env.local` e o nome do projeto do Compose. Unitários em `test/scripts/worktree-env.spec.ts`, que o projeto `unit` já inclui (`test/**/*.spec.ts`). O efeito colateral (git, rede, Postgres, Redis, Mailpit, `npm`) fica no `worktree.mjs`.
- O `setup`, nesta ordem:
  1. Recusa rodar no checkout principal, onde o `.git` da raiz é um diretório. Acha o principal pela primeira linha de `git worktree list --porcelain` (ou pelo `dirname` do `git rev-parse --path-format=absolute --git-common-dir`). Recusa também se o principal não tem `.env`, com a instrução `cp .env.example .env` lá.
  2. Reserva o slot: mantém o `WORKTREE_SLOT` do `.env` do worktree se houver um. Senão, escolhe o menor `N` de 1 a 15 que nenhum outro worktree da lista tenha no `.env` e cuja porta `3000 + N` esteja livre (um `net.createServer().listen(port)` que fecha em seguida). Sem slot livre, falha listando os worktrees e os slots deles.
  3. Gera o `.env` a partir do `.env` do principal:
     - reescreve no lugar `PORT=3000+N`, o banco da `DATABASE_URL` para `app_wt<N>` (trocando só o pathname, como o `databaseUrl` de `test/helpers/database.ts`), o banco do `REDIS_URL` para `/N` e o usuário do `SMTP_URL` para `wt<N>:x`;
     - acrescenta num bloco final marcado `# gerado pelo worktree:setup; rode de novo para regerar`: `WORKTREE_SLOT`, `MAILPIT_TAG=wt<N>`, `COMPOSE_PROJECT_NAME` e o `OTEL_RESOURCE_ATTRIBUTES` com `deployment.environment.name=wt<N>` somado ao do principal, se houver;
     - o `COMPOSE_PROJECT_NAME` é o do `.env` do principal ou, sem ele, o basename da pasta do principal normalizado como o Compose faz (minúsculas, só `[a-z0-9_-]`, sem `_`/`-` no início).
  4. Copia o `.env.local` do principal, se houver, sem as chaves que o passo anterior escreveu, e avisa quais saíram.
  5. `npm ci` só sem `node_modules`; com ele, avisa que pulou. A opção `--install` força.
  6. `docker compose up -d --wait postgres redis mailpit`. Com o `COMPOSE_PROJECT_NAME` do `.env`, mira o projeto do principal.
  7. Se o slot acabou de ser reservado, zera o resto: `DROP DATABASE IF EXISTS "app_wt<N>" WITH (FORCE)`, `FLUSHDB` no banco `N` e `DELETE /api/v1/search?query=tag:wt<N>` no Mailpit. Depois, com o slot novo ou não, cria o `app_wt<N>` se ele não existir (consulta ao `pg_database`). Usa o `pg` e o `ioredis`, que já são dependências da app, sem `docker exec`.
  8. `npm run db:setup` e `npm run db:seed`.
  9. Imprime o resumo: slot, a API em `http://localhost:<3000 + N>`, banco, Redis, a busca do Mailpit (`http://localhost:8025/#search?q=tag:wt<N>`), e "para limpar: `npm run worktree:down`; nunca `docker compose down -v` aqui".
- Leia `docs/how-to/adicionar-uma-variavel-de-ambiente.md`: `WORKTREE_SLOT` e `MAILPIT_TAG` não entram no `env.validation.ts` (a app não os lê), mas entram no `docs/reference/variaveis-de-ambiente.md` no passo 11.

**Pronto quando:**

- Unitários cobrem: o slot mantido, o menor livre, o pulo de um slot reservado e de uma porta ocupada, nenhum slot livre, a reescrita das quatro URLs, o bloco gerado sem duplicar chaves ao rodar duas vezes, o `OTEL_RESOURCE_ATTRIBUTES` somado, o filtro do `.env.local` e a normalização do nome do projeto.
- Num worktree descartável criado com `git worktree add`, `npm run worktree:setup` termina com o banco `app_wt1` migrado e semeado, e `npm run start:dev` responde em `http://localhost:3001/health/ready`.
- Rodar o setup de novo no mesmo worktree mantém o slot e os dados (o usuário criado à mão continua lá), e não roda `npm ci`.
- Um segundo worktree recebe o slot 2.
- No checkout principal, o setup recusa e não muda nada.
- `docker ps` mostra só os três containers do principal.

### Passo 4: `worktree:down`

**Por quê:** limpar um worktree não pode ser o `docker compose down -v`, que apagaria os dados de todos.

**Faça:**

- Subcomando `down` em `scripts/worktree.mjs`: recusa no checkout principal e num worktree sem `WORKTREE_SLOT`. Faz `DROP DATABASE IF EXISTS "app_wt<N>" WITH (FORCE)`, `FLUSHDB` no banco `N` do Redis e `DELETE` das mensagens com a tag no Mailpit. Não chama o `docker compose`. Deixa o `.env` como está.
- Ao fim, imprime: "o slot continua reservado enquanto o worktree existir; para liberá-lo, `git worktree remove <caminho>`".

**Pronto quando:**

- No worktree do passo 3, `npm run worktree:down` apaga o `app_wt1`, esvazia o banco 1 do Redis (`DBSIZE` 0) e as mensagens `wt1`. O `app`, o banco 0 do Redis e as mensagens do principal continuam lá.
- `npm run worktree:setup` em seguida recria o banco vazio, migrado e semeado.
- No checkout principal, o `down` recusa.

### Passo 5: guard nos pre-scripts

**Por quê:** um worktree com o `.env` copiado à mão, ou sem `.env` nenhum no caso do e2e, roda contra o banco `app` e o Redis 0 do principal em silêncio.

**Faça:**

- `scripts/worktree-guard.mjs`: se o `.git` da raiz é um arquivo e o `WORKTREE_SLOT` não está nem no ambiente nem no `.env.local` ou no `.env` (lidos com `dotenv.parse`), sai com código 1 e a mensagem "Este checkout é um worktree sem ambiente próprio: rode `npm run worktree:setup`". Não abre processo do git.
- `package.json`: `prestart:dev`, `pretest:e2e`, `predb:setup` e `predb:seed` chamam o guard.
- Confira que o `scripts/run-scripts.mjs`, que roda os `mig:*:run`, não dispara o guard uma vez por módulo: o pre-script fica no `db:setup`, não nos `mig:*`.

**Pronto quando:**

- Num worktree descartável com o `.env` copiado à mão do principal, `npm run start:dev`, `npm run test:e2e`, `npm run db:setup` e `npm run db:seed` falham com a mensagem, antes de abrir conexão.
- Depois do `worktree:setup`, os quatro rodam.
- No checkout principal, os quatro rodam como antes.
- `npm run ci` passa. O job `e2e` do CI, que roda `db:setup` e `test:e2e`, passa (o checkout do Actions tem `.git` como diretório).

---

## Fase 2: E2E por worktree

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 6: `test/setup-env.ts` lê as chaves de conexão
> - [ ] Passo 7: busca do Mailpit pela tag
> - [ ] Passo 8: aceite da issue

### Passo 6: `test/setup-env.ts` lê as chaves de conexão

**Por quê:** o `setup-env.ts` define `DATABASE_URL`, `REDIS_URL` e `SMTP_URL` com `??=` antes de o `AppModule` ler os arquivos, e o ambiente vence os arquivos. Num worktree, o e2e cairia no banco `app` e no Redis 0 do principal.

**Faça:**

- No começo do `test/setup-env.ts`: para cada arquivo do `ENV_FILES` (`#shared/infra/config/load-env-files`), na ordem, um `dotenv.parse` do arquivo, se existir. Copie para o `process.env` só `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`, `MAILPIT_API_URL` e `MAILPIT_TAG`, sem sobrescrever o que já está definido. A primeira definição vence. Depois vêm os `??=` de hoje.
- Respeite o `ignoresEnvFiles`: com `NODE_ENV=production` no ambiente, nada é lido dos arquivos.
- Não carregue as outras chaves: o `THROTTLE_ENABLED`, o `LOG_LEVEL` e os workers do `.env` vazariam para os testes.
- O `test:int` não usa essas variáveis (recebe as URLs do Testcontainers pelo `inject`), mas carrega o mesmo `setupFiles`. Confira que ele continua passando.

**Pronto quando:**

- Num worktree com setup, `npm run test:e2e -- health` grava no `app_wt<N>` e não no `app`: um usuário criado pelo e2e aparece só no banco do worktree.
- No checkout principal sem `.env.local`, o e2e usa as mesmas URLs de antes.
- `DATABASE_URL=… npm run test:e2e` no shell continua vencendo os arquivos.
- `npm run test:int` passa.

### Passo 7: busca do Mailpit pela tag

**Por quê:** os e2e de dois worktrees leem o mesmo Mailpit. Os endereços já são únicos (`test/helpers/auth.ts`), mas o filtro pela tag deixa o isolamento explícito e não depende disso.

**Faça:**

- `test/helpers/mailpit.ts`: com `process.env.MAILPIT_TAG`, a query de `emailsTo` vira `tag:"<tag>" to:"<endereço>"`. Sem a variável, fica como hoje.
- Se o passo 1 trocou a decisão para o Mailpit sem tags, este passo vira só a conferência de que os endereços continuam únicos, registrada no **Como ficou**.

**Pronto quando:**

- Num worktree com setup, `npm run test:e2e -- auth` passa, e os e-mails dele aparecem no Mailpit com a tag `wt<N>`.
- No checkout principal, `npm run test:e2e -- auth` passa sem `MAILPIT_TAG`.

### Passo 8: aceite da issue

**Por quê:** os critérios de "Pronto quando" da issue #35, conferidos de uma vez.

**Faça:**

- Dois worktrees descartáveis, cada um com `worktree:setup`.
- Ao mesmo tempo, nos dois: `docker compose up -d` (não faz nada), `npm run db:setup`, `npm run start:dev`. Depois encerre os dois `start:dev` e rode `npm run test:e2e` nos dois ao mesmo tempo.
- Um `start:dev` no checkout principal ao mesmo tempo que os e2e dos worktrees.
- Mais uma vez, no checkout principal, sem nenhum `.env` novo: `docker compose up -d`, `npm run db:setup`, `npm run test:e2e`.
- Meça e registre: o tempo do `worktree:setup` com e sem `node_modules`, e o pico de conexões no Postgres durante os e2e em paralelo (`SELECT count(*) FROM pg_stat_activity`).
- Remova os worktrees descartáveis com `npm run worktree:down` e `git worktree remove`.

**Pronto quando:**

- Os dois `start:dev` sobem sem conflito de porta, cada um no seu banco e no seu banco lógico do Redis.
- Os dois `npm run test:e2e` passam em paralelo, com o `start:dev` do principal no ar.
- O checkout único funciona sem passo novo.
- O pico de conexões ficou abaixo de 200.
- `npm run ci` passa.

---

## Fase 3: Documentação

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 9: ADR 0011
> - [ ] Passo 10: how-to de worktrees em paralelo
> - [ ] Passo 11: páginas de referência e explicação
> - [ ] Passo 12: AGENTS.md e índice

### Passo 9: ADR 0011

**Por quê:** a decisão é difícil de reverter (espalha-se pelo script, pelo `setup-env.ts`, pelo guard e pelas docs), surpreende sem contexto e saiu de trade-offs reais.

**Faça:**

- `docs/adr/0011-worktrees-compartilham-o-stack-do-checkout-principal.md`, no formato dos ADRs existentes. Contexto (a issue e o incidente da pesquisa), decisão (a tabela deste plano, resumida), alternativas descartadas com o motivo de cada uma (stack por worktree, prefixo na app, hook `WorktreeCreate`, `.worktreeinclude`, porta efêmera, hash) e consequências:
  - o teto de 15 worktrees;
  - o `docker compose down -v` proibido num worktree;
  - uma branch que muda o `docker-compose.yml` recria o stack de todos;
  - os worktrees presos à mesma versão do Postgres e do Redis;
  - o Redis Cluster sem banco lógico, sem efeito local.
- Liste o ADR no índice de `docs/README.md`, se os ADRs estiverem lá.

**Pronto quando:** `npm run docs:check` passa, e o ADR cita a issue #35.

### Passo 10: how-to de worktrees em paralelo

**Por quê:** é o critério da issue e a porta de entrada de quem cria um worktree.

**Faça:**

- `npm run plop doc how-to "trabalhar com worktrees em paralelo"`. Pré-requisitos (o principal com `.env` e o compose no ar). Passos: criar o worktree (herdr, `claude --worktree` ou `git worktree add`), `npm run worktree:setup`, `npm run start:dev`, `npm run test:e2e`. Como verificar (a URL do health e a busca do Mailpit pela tag). Como limpar: `npm run worktree:down`, depois `git worktree remove`. Por que nunca `docker compose down -v` num worktree.
- O que acontece com um worktree removido sem `down`, e que o profile `prod` só roda no principal.
- Ponha a página no índice do `docs/README.md`.

**Pronto quando:** seguindo só o how-to, um worktree novo sobe e passa no e2e. `npm run docs:check` passa.

### Passo 11: páginas de referência e explicação

**Faça:**

- `docs/reference/comandos.md`: `worktree:setup` e `worktree:down` numa tabela; o guard nos quatro comandos; os cuidados com o e2e reescritos por checkout; "Baixar o ambiente" só no principal; o `max_connections` do compose.
- `docs/reference/variaveis-de-ambiente.md`: `WORKTREE_SLOT`, `MAILPIT_TAG`, `COMPOSE_PROJECT_NAME` e `OTEL_RESOURCE_ATTRIBUTES` (com o `deployment.environment.name`), e a seção de testes com as cinco chaves que o `setup-env.ts` lê dos arquivos.
- `docs/reference/testes.md`: a linha do e2e (contra o stack do checkout) e a do `test/helpers/mailpit.ts` (filtro pela tag).
- `docs/how-to/resetar-o-ambiente-local.md`: o reset pelo `down -v` só no principal, e ele apaga também os dados de todos os worktrees; num worktree, `worktree:down` e `worktree:setup`.
- `docs/how-to/fazer-o-deploy.md`: o profile `prod` só no checkout principal, com o porquê.
- `docs/explanation/redis.md`: o banco lógico por worktree e por que não um prefixo de chave.
- O comentário do `fileParallelism: false` no `vitest.config.ts`: "grava no banco deste checkout".

**Pronto quando:** `npm run docs:check` passa, e `grep -rn "docker compose down" docs README.md AGENTS.md` não mostra nenhum trecho sem a ressalva do worktree.

### Passo 12: AGENTS.md e índice

**Faça:**

- **Armadilhas:**
  - E2E: "Encerre o `start:dev` deste checkout antes; worktrees com `worktree:setup` não interferem entre si."
  - Uma armadilha nova: "Num worktree novo, rode `npm run worktree:setup` antes de qualquer outro comando."
  - "Baixar o ambiente": o `docker compose down -v` só no checkout principal; num worktree, `npm run worktree:down`.
- **Rotas:** "Criar ou limpar um worktree, ou rodar dois ambientes em paralelo" → o how-to do passo 10.
- Tire a rota "Continuar um plano em andamento", apague este arquivo e atualize a linha de planos do `docs/README.md` com o link para o registro na issue #35.

**Pronto quando:** `npm run ci` passa, o `/simplify` e o `/code-review` rodaram sobre o PR inteiro, e o registro do plano está num comentário da issue #35, publicado com o ok do dono.
