---
type: reference
---

# Comandos

Todos os comandos rodam na raiz do repositório.

## Requisitos

- Node 22.22.3 ou superior na linha 22, 24.11.1 ou superior na linha 24, ou 25.1.0 ou superior (`engines` do `package.json`). O `.nvmrc` recomenda o 24.
- Docker, para o Postgres, o Redis e o Mailpit do `docker-compose.yml` e para os testes de integração.

## Setup do zero

Nesta ordem:

1. `npm install`. Instala também os [hooks do git](#hooks-do-git), pelo `prepare`. O npm pode avisar que pacotes como `argon2` e `ssh2` têm scripts de instalação não aprovados. O setup funciona sem aprová-los: o `argon2` usa um binário pronto (conferido em 2026-11-23, com o npm 11.20 e o Node 26).
2. `cp .env.example .env`. Cada variável está em [Variáveis de ambiente](variaveis-de-ambiente.md).
3. `docker compose up -d postgres redis mailpit`. Sobe o Postgres 19 em `127.0.0.1:5432`, com `max_connections=200` para caber os worktrees, o Redis 8 em `127.0.0.1:6379` e o Mailpit 1, o SMTP de desenvolvimento, em `127.0.0.1:1025`. O Mailpit aceita envio com ou sem usuário SMTP e marca cada e-mail com o usuário, que vira a tag de um [worktree](#worktrees).
4. As [migrations](#migrations) de todos os módulos, depois os [seeds](#seeds):

   ```sh
   npm run db:setup
   npm run db:seed
   ```

5. `npm run start:dev`.

Num `git worktree`, o setup é outro: [Worktrees](#worktrees).

Com a app no ar:

| Endereço | O que é |
| --- | --- |
| `http://localhost:3000/v1/...` | API, versionada na URL |
| `http://localhost:3000/docs` | Swagger. Só existe fora de `NODE_ENV=production` |
| `http://localhost:3000/health/live` | O processo está vivo. Não consulta dependências |
| `http://localhost:3000/health/ready` | O banco e o Redis respondem |
| `http://localhost:8025` | Mailpit: os e-mails que a app enviou, como o código de verificação. Nada sai para fora. A API do Mailpit, que o e2e usa, fica em `/api/v1` |

O health não tem versão na URL, não pede token e fica fora do rate limit. O que cada endereço confere e responde está em [Operação](operacao.md).

## Desenvolvimento e build

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run build` | Compila para `dist/`. Para rodar o build: `node dist/main.js`. Não há script `start` |

## Verificação

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint com regras que usam tipos, `--max-warnings 0` ([ADR 0004](../adr/0004-lint-e-formatacao.md)) |
| `npm run format` | Aplica o Prettier. O Markdown fica fora ([ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md)) |
| `npm run format:check` | Só confere a formatação |
| `npm run arch` | Regras de camadas e de fronteiras entre módulos, com o dependency-cruiser (`.dependency-cruiser.js`) |
| `npm run docs:check` | Lint do Markdown, links e âncoras locais, `type:` das páginas de `docs/` e comentários de template que sobraram. Também confere que cada pasta de `src/modules/` está no índice de módulos do `docs/README.md` e que cada página de módulo tem um módulo; que o `AGENTS.md` não usa `@caminho`; e que os caminhos de `docs/` citados no `AGENTS.md` e nos arquivos de `.claude/` existem (`scripts/remark-docs-rules.mjs`) |
| `npm run docs:links` | Links externos, com o lychee via Docker. Pula os endereços locais (`localhost`), que só respondem com a app ou o compose no ar. Fora do CI, porque depende da rede |
| `npm run ci:static` | `typecheck`, `lint`, `format:check`, `docs:check` e `arch`, nessa ordem. O job `check` do CI roda o `ci:static` e o `audit:signatures` |
| `npm run ci` | `ci:static` e depois `test:coverage`: os unitários com a meta de cobertura ([Testes](testes.md#cobertura)). **Não** roda integração nem e2e, nem o `audit:signatures` |
| `npm run audit:signatures` | `npm audit signatures`: confere a assinatura do registry e as attestations de cada pacote instalado. Precisa da rede. Não olha advisories: eles ficam com os Dependabot alerts e o dependency review ([CI](#ci)) |

## Hooks do git

O lefthook roda os hooks do `lefthook.yml`, e o commitlint confere as mensagens pelas regras do `commitlint.config.mjs` ([ADR 0013](../adr/0013-hooks-do-git-com-lefthook-e-commitlint.md)).

| Hook | O que roda | Em quais arquivos |
| --- | --- | --- |
| `pre-commit` | Em sequência, parando no primeiro erro: o Prettier com `--write`, que põe a correção no stage; o ESLint, sem `--fix`, com `--max-warnings 0`; o `markdownlint-cli2`. Não roda durante um merge nem um rebase | Os arquivos em stage: o Prettier em todos que ele formata, o ESLint nos `.ts`, `.mts`, `.cts`, `.js`, `.mjs` e `.cjs`, o markdownlint nos `.md`. Os que o `.prettierignore` e o `eslint.config.mjs` ignoram ficam de fora. Com um arquivo parcialmente em stage, a parte fora do stage fica guardada durante o hook e volta no fim |
| `commit-msg` | O commitlint sobre a mensagem: o formato do [Conventional Commits](../../.github/CONTRIBUTING.md#commits-e-título-do-pr), com os tipos do projeto e o cabeçalho de até 100 caracteres. Os `fixup!`, `squash!`, `Merge …` e `Revert …` passam | A mensagem do commit |
| `pre-push` | Em paralelo: `npm run typecheck` e `npm run arch` | O projeto inteiro, como está no disco: uma mudança fora do commit entra na conferência |

- **Pular:** `git commit --no-verify` e `git push --no-verify` pulam o hook daquele comando; `LEFTHOOK=0` pula todos (`LEFTHOOK=0 git commit …`). `LEFTHOOK_EXCLUDE=<tag>` pula um job só; a tag de cada job é o nome dele (`LEFTHOOK_EXCLUDE=eslint git commit …`). Para um ajuste só na sua máquina, um `lefthook-local.yml` na raiz, fora do git, é mesclado ao `lefthook.yml`.
- **Instalação:** o `prepare` do `npm install` roda o `scripts/install-git-hooks.mjs`, que roda o `lefthook install`. Ele não faz nada com `CI` ligado, com `LEFTHOOK=0`, sem `.git` na raiz e num worktree, e diz por quê. Uma falha vira aviso e não quebra o `npm install`. Os hooks ficam no diretório comum do git e valem no checkout principal e em todo worktree. Para reinstalar, no checkout principal: `npx lefthook install`. O hook guarda o caminho do lefthook de quem o instalou, e um worktree removido levaria o binário junto.
- **O que fica com o CI:** os testes, o `format:check` e o `docs:check` do projeto inteiro e o título do PR, que vira o commit da `main` no squash ([CI](#ci)).

## Testes

| Comando | O que roda |
| --- | --- |
| `npm test` | Unitários (`*.spec.ts`), sem banco |
| `npm run test:watch` | Os unitários em modo watch |
| `npm run test:coverage` | Os unitários com cobertura, sobre o `src/`: resumo no terminal, HTML em `coverage/index.html` e `coverage/coverage-summary.json`. Falha se `domain/` ou `application/` ficar abaixo do piso ([Testes](testes.md#cobertura)) |
| `npm run test:int` | Integração (`*.int-spec.ts`). Sobe um Postgres e um Redis descartáveis com o Testcontainers para a execução inteira, então exige Docker. Os arquivos rodam em paralelo, cada um no seu banco ([Testes](testes.md#convenções)) |
| `npm run test:e2e` | E2E (`test/*.e2e-spec.ts`). Sobe o app inteiro contra o banco de `DATABASE_URL`, o Redis de `REDIS_URL` e o SMTP de `SMTP_URL` do checkout, e lê os e-mails pela API do Mailpit |

O runner, o `test/setup-env.ts`, a decorator metadata e qual tipo de teste cobre cada camada estão em [Testes](testes.md).

Para rodar um arquivo só, passe um padrão de caminho depois do `--`. O filtro por nome e por linha está em [Como rodar um teste específico](../how-to/rodar-um-teste-especifico.md).

- `npm test -- money.vo`
- `npm run test:int -- pay-order`
- `npm run test:e2e -- auth`

Cuidados com o e2e:

- O e2e lê `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`, `MAILPIT_API_URL` e `MAILPIT_TAG` do ambiente, do `.env.local` e do `.env` do checkout, nessa precedência. Sem elas, apontam para o Postgres, o Redis e o Mailpit do `docker-compose.yml`, que precisam estar no ar. O endereço da API do Mailpit padrão é `http://127.0.0.1:8025`.
- O e2e **grava dados** no banco do checkout: o `app` no principal, o `app_wt<N>` num worktree.
- Encerre antes o `start:dev` deste checkout. Outra instância no mesmo Redis consome as filas do BullMQ e derruba os testes. O `start:dev` e o e2e de outro worktree com `worktree:setup` não interferem.

## Worktrees

Cada `git worktree` ganha a sua porta, o seu banco, o seu banco lógico do Redis e a sua tag no Mailpit, sobre o stack do checkout principal ([ADR 0011](../adr/0011-worktrees-compartilham-o-stack-do-checkout-principal.md)). Passo a passo: [Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md).

| Comando | O que faz |
| --- | --- |
| `npm run worktree:setup` | Só num worktree. Reserva o slot `N` (de 1 a 15), gera o `.env` a partir do `.env` do principal (porta `3000 + N`, banco `app_wt<N>`, banco lógico `N` do Redis, usuário SMTP `wt<N>`), copia o `.env.local` do principal sem essas chaves, roda o `npm ci` se falta `node_modules` (`-- --install` força), sobe o stack do principal, cria o banco e roda o `db:setup` e o `db:seed`. Na primeira reserva, apaga o que um worktree removido deixou no slot. Rodado de novo, mantém o slot e os dados (`scripts/worktree.mjs`) |
| `npm run worktree:down` | Só num worktree com slot. Apaga o banco `app_wt<N>`, esvazia o banco lógico `N` do Redis e as mensagens da tag `wt<N>`. Não toca em containers nem volumes. O slot fica reservado até o `git worktree remove` |

- **Trava:** o `start:dev`, o `test:e2e`, o `db:setup` e o `db:seed` rodam antes o `scripts/worktree-guard.mjs`. Num worktree (o `.git` da raiz é um arquivo) sem `WORKTREE_SLOT` no ambiente, no `.env.local` ou no `.env`, ele para com "rode `npm run worktree:setup`". No principal e no CI, não faz nada.
- **Hooks do git:** os do checkout principal valem no worktree desde a criação ([Hooks do git](#hooks-do-git)). Antes do `worktree:setup`, sem `node_modules`, o commit falha no hook.
- **Compose num worktree:** o `.env` gerado tem o `COMPOSE_PROJECT_NAME` do principal, então o `docker compose up -d` mira o stack compartilhado e não faz nada se ele já estiver no ar. Ele usa o `docker-compose.yml` da branch: se a branch muda um serviço, o Compose o recria para todos. O `worktree:setup` sobe o stack pelo `docker-compose.yml` do principal, e não pelo da branch. Nunca `docker compose down -v` nem `stop` num worktree: alcançam o stack de todos.

## CI

O porquê das escolhas de segurança está na [ADR 0012](../adr/0012-cadeia-de-suprimentos-do-ci.md).

| Workflow | Quando roda | O que faz |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Todo PR e todo push na `main` | Verificação estática, assinaturas do registry, unitários, integração e e2e. Jobs na tabela abaixo |
| `.github/workflows/codeql.yml` | PR para a `main`, push na `main` e todo domingo às 03:00 UTC | CodeQL em advanced setup, com a suíte `default`, sem build (`build-mode: none`): um job `Analyze (javascript-typescript)` para o código e um `Analyze (actions)` para os workflows. Os alertas vão para a aba Security → Code scanning |
| `.github/workflows/dependency-review.yml` | Todo PR | Job `dependency-review`: falha se o PR traz uma dependência com vulnerabilidade `high` ou acima, ou com licença fora do `allow-licenses`. Uma exceção de licença por pacote vai no `allow-dependencies-licenses`, com o motivo num comentário. Comenta o resumo no PR quando falha |
| `.github/workflows/pr-title.yml` | PR aberto, editado, reaberto ou com push novo | Job `pr-title`: confere o título do PR, que vira o commit da `main` no squash, com o commitlint e o `commitlint.config.mjs`, as mesmas regras do hook `commit-msg` ([Hooks do git](#hooks-do-git)) |
| `.github/workflows/verify-lockfile.yml` | Todo PR e todo push na `main` | Job `verify-lockfile`: `gh actions-lock --verify`, que falha se o `.github/workflows/actions.lock` não bate com os workflows ou se um commit travado não confere mais com o upstream |

O `ci.yml`: num PR, um push novo cancela a execução anterior do mesmo PR. Na `main`, cada push roda até o fim, sem fila com os outros.

| Job | Em PR | Na `main` | Node |
| --- | --- | --- | --- |
| `changes` | Compara o PR com a branch de destino e diz se ele muda código | Roda sem checkout e diz que muda: a `main` sempre testa | — |
| `check` | `npm run ci:static`, no projeto inteiro, e depois `npm run audit:signatures`, num step próprio | O mesmo | `.nvmrc` |
| `unit` | No `22.22.3`, `npm test -- --changed HEAD^1 --passWithNoTests`. No `.nvmrc`, `npm run test:coverage`, com a suíte inteira, e a tabela de cobertura no resumo do job | No `22.22.3`, `npm test`. No `.nvmrc`, `npm run test:coverage` e a tabela | `22.22.3` e `.nvmrc`, em matriz |
| `integration` | `npm run test:int -- --changed HEAD^1 --passWithNoTests` | `npm run test:int` | `.nvmrc` |
| `e2e` | Copia o `.env.example` para `.env` e roda `npm run db:setup`, depois `npm run test:e2e -- --changed HEAD^1 --passWithNoTests`, contra Postgres, Redis e Mailpit em `services:` | O mesmo, com `npm run test:e2e` | `.nvmrc` |
| `ci` | Falha se um dos outros falhou ou foi cancelado. Um job pulado conta como aprovado. É o check obrigatório do PR | O mesmo | — |

- **PR só de Markdown:** quando todos os arquivos do PR são `*.md` ou estão em `docs/`, o `unit`, o `integration` e o `e2e` são pulados, e o `ci` passa. O filtro fica num job, e não no gatilho do workflow, para o check obrigatório continuar aparecendo no PR.
- **Só os testes afetados:** em PR, o checkout é o merge do PR na branch de destino, e `HEAD^1` é a ponta da branch de destino. O `--changed HEAD^1` roda os testes ligados por import aos arquivos do PR, ou a suíte inteira quando o PR muda um arquivo do `forceRerunTriggers` do `vitest.config.ts`. Um PR verde pode não ter rodado um teste que o grafo de imports não liga à mudança. A `main` roda tudo e pega o que escapou. O que o `--changed` enxerga: [Testes](testes.md#só-os-testes-afetados).
- **Cobertura:** só a entrada `.nvmrc` do `unit` mede, e roda os unitários inteiros também em PR: com o `--changed`, o relatório e a meta ficariam só com os arquivos do diff. Um step com `if: "!cancelled() && matrix.coverage && hashFiles('coverage/coverage-summary.json') != ''"` roda o `node scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"`, que acrescenta a tabela por camada (`domain`, `application`, `contracts`, infra e o resto, e o total) ao resumo dos testes que o reporter `github-actions` do Vitest já escreve. A tabela aparece também quando a meta falha, porque o Vitest grava o relatório antes de conferir a meta, e não aparece quando um teste falha, que não gera relatório, nem numa execução cancelada, que poderia deixar um relatório pela metade. O que é medido e a meta: [Testes](testes.md#cobertura).
- **Instalação em cache:** os jobs `check`, `unit`, `integration` e `e2e` usam a composite action `.github/actions/setup`. Ela instala o Node e restaura o `node_modules` do `actions/cache`, com a chave `node-modules-<SO>-<versão do Node resolvida>-<hash do package-lock.json>`, e roda `npm ci` só quando o cache não acerta. Mudar o lockfile ou a versão do Node gera um cache novo.
- **Sem fail-fast:** os jobs rodam em paralelo, a matriz do `unit` não cancela a outra versão quando uma falha, e o Vitest não para no primeiro erro. Todos os resultados saem de uma vez. Quando rever: [Evoluções com gatilho](evolucoes-com-gatilho.md#ci).
- **E2E:** os `services:` usam as imagens do `docker-compose.yml`, nas portas que o `test/setup-env.ts` espera, com o Postgres sem durabilidade e em tmpfs, como o da integração. Sobem e esperam o healthcheck antes do primeiro step, o que custa uns 15 s ao job. Localmente, o e2e continua no docker-compose.
- **Fora do CI:** o `docs:links`, que depende da rede.
- **Checks obrigatórios:** o `ci`, o `dependency-review`, o `verify-lockfile` e o `pr-title`, todos do GitHub Actions. O nome de cada um é o do job: renomear um job exige mudar o `scripts/setup-github.mjs` e rodar o `npm run github:setup`. A matriz do `unit` pulada não expande, e o check dela fica com o nome cru da expressão, por isso o `ci` junta os jobs do `ci.yml`.
- **Regra do CodeQL:** a regra `code_scanning` do ruleset barra o merge enquanto a análise do CodeQL do PR não termina e quando ela acha, nas linhas que o PR muda, um alerta de segurança `high` ou acima ou um alerta de severidade `error`. Os alertas antigos não barram, mas ficam abertos na aba Security.
- **Falso positivo do CodeQL:** na aba Security → Code scanning, abra o alerta e use "Dismiss alert", com o motivo ("False positive", "Used in tests" ou "Won't fix") e um comentário que explique. Não desligue a regra nem tire o arquivo da análise.
- **Lockfile das actions:** o `.github/workflows/actions.lock` guarda o commit, o `owner_id` e o `repo_id` de cada action, inclusive as transitivas e as da composite `.github/actions/setup`, que os workflows chamam por `$/.github/actions/setup` (a própria action no commit do workflow). O runner confere o lockfile no início do job.
  - Instale a extensão uma vez: `gh extension install github/gh-actions-lock --pin v0.5.1`.
  - Depois de adicionar ou mudar um `uses:`, num workflow ou na composite, rode `gh actions-lock` na raiz, revise o diff inteiro e commite o `actions.lock`. Uma troca de `commit` é uma troca de código; uma troca de `owner_id` ou `repo_id` indica outro repositório atrás do nome e precisa de investigação. Nunca edite o lockfile à mão.
  - Para conferir sem rede se cada `uses:` tem entrada no lockfile: `gh actions-lock --verify-local`. O `gh actions-lock --verify` faz a conferência completa do CI.
  - Numa action do próprio repositório, use `$/` e não `./`: o `./` não entra no lockfile.
  - O actionlint local não conhece o `$/`: a exceção fica no `.github/actionlint.yaml`.
- **`npm run github:setup`** (`scripts/setup-github.mjs`): cria, ou atualiza, um ruleset na branch padrão do repositório do `origin` que exige os checks obrigatórios, inclusive em push direto, tem a regra do CodeQL e bloqueia force push e exclusão. Ao atualizar, mantém o bypass e as regras de outros tipos acrescentados pela interface. Também deixa o squash como único merge de PR, com o título e a descrição do PR como mensagem do commit (o título segue o Conventional Commits, ver [Como contribuir](../../.github/CONTRIBUTING.md#commits-e-título-do-pr)), e apaga o branch do PR depois do merge. Liga os Dependabot alerts, os Dependabot security updates e a exigência de action fixada por SHA (`sha_pinning_required`), mantendo o resto das permissões do GitHub Actions. Num repositório público, liga o relato privado de vulnerabilidade, o canal do `.github/SECURITY.md`. Num privado ou interno, o GitHub não oferece esse relato, e o script só avisa. A regra do CodeQL entra num repositório público, ou num privado ou interno com o GitHub Code Security; sem ele, o script avisa e segue sem a regra. Não liga o secret scanning. Pede o `gh` autenticado com admin no repositório. Num repositório privado, o GitHub pode exigir plano pago para rulesets.
- **Dependabot:** abre os PRs de atualização do npm, das actions e das imagens, que passam pelos mesmos checks. A agenda, os grupos e o `ignore` estão em [Versões e exceções → Atualização automática](versoes-e-excecoes.md#atualização-automática).
- **"Require lockfile", à mão:** a política que bloqueia um workflow sem lockfile não tem API. Depois do `npm run github:setup`, ligue-a em Settings → Actions → Policies, mirando todos os workflows, com o enforcement `Active`.

## Migrations

Cada módulo tem as suas migrations e o seu script. Elas **não** rodam sozinhas ao subir a app (`synchronize: false` e `migrationsRun: false`): rode-as antes, no setup local e no pipeline de deploy. Passo a passo para criar uma: [Como gerar uma migration](../how-to/gerar-uma-migration.md). Para aplicar todas e conferir o que falta: [Como rodar as migrations e os seeds](../how-to/rodar-as-migrations-e-os-seeds.md).

| Comando | O que faz |
| --- | --- |
| `npm run db:setup` | Aplica as migrations pendentes de todos os módulos: roda cada script `mig:<módulo>:run` do `package.json`, um depois do outro, e para no primeiro que falhar (`scripts/run-scripts.mjs`). Um módulo novo entra sozinho |
| `npm run mig:<módulo>:run` | Aplica as migrations pendentes de um módulo. Um script por módulo com tabelas, mais o `outbox` |
| `npm run mig:<módulo>:gen` | Gera uma migration comparando as entidades com o banco, que precisa estar no ar |
| `npm run db:migrate:prod` | O `db:setup` de produção: roda cada `mig:<módulo>:run:prod`, a partir do `dist/`. É o passo de migration da imagem Docker ([Como fazer o deploy](../how-to/fazer-o-deploy.md)) |
| `npm run mig:<módulo>:run:prod` | Aplica as migrations pendentes de um módulo com o data source compilado (`typeorm migration:run -d dist/.../<módulo>.data-source.js`). Exige `npm run build` antes |

Os scripts `:run` e `:gen` usam `typeorm-ts-node-esm` com `NODE_OPTIONS=--conditions=@app/source`. Sem essa condição, os aliases `#...` carregam o `dist/`, que pode estar desatualizado, e nada avisa ([ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md)).

Os `:run:prod` fazem o contrário: rodam o JavaScript do `dist/`, sem `ts-node`, que não existe na imagem de produção, e sem `@app/source`, para os aliases caírem no `dist/`. O padrão do `db:setup` (`^mig:.+:run$`) não casa com eles.

## Seeds

Só para desenvolvimento. Dados que o sistema precisa para funcionar vão numa migration. Para criar o seed de um módulo, ver [Como criar um seed](../how-to/criar-um-seed.md).

- `npm run db:seed` roda todos: cada script `seed:<módulo>` do `package.json`, um depois do outro, e para no primeiro que falhar (`scripts/run-scripts.mjs`). Um seed novo entra sozinho.
- `npm run seed:<módulo>` roda o de um módulo só. Só tem seed o módulo com um script `seed:<módulo>` no `package.json`. O que cada seed cria está na doc do módulo, em [Módulos](../README.md#módulos).
- Rode as migrations antes.
- Só rodam com `NODE_ENV=development` ou `test`. Qualquer outro valor, ou nenhum, recusa.
- Inserem só o que falta e não sobrescrevem o que existe, então podem rodar mais de uma vez.
- Usuários de teste: `admin@example.com` e `user@example.com`, os dois com a senha `Senha@12345`.

## Geradores

| Comando | O que gera |
| --- | --- |
| `npm run plop module <nome>` | Um módulo com todas as camadas, com o nome no singular. Registra o módulo no `src/app.module.ts`, cria os scripts `mig:<nome>:gen`, `mig:<nome>:run` e `mig:<nome>:run:prod` e cria o helper dos testes de integração, `test/helpers/<nome>-database.ts`. Gera também `docs/reference/modules/<nome>.md`, que falha no `docs:check` até os comentários do template serem apagados, e a lista o módulo no índice de `docs/README.md`, onde falta escrever a descrição de uma linha. Rode `npm run mig:<nome>:run` antes de subir a app. Os passos seguintes estão em [Como criar um módulo](../how-to/criar-um-modulo.md). Templates em `plop-templates/module/` e `plop-templates/doc/module.md.hbs` |
| `npm run plop doc <tipo> "<nome>"` | Uma página de `docs/` do tipo `tutorial`, `how-to`, `reference` ou `explanation`. Templates em `plop-templates/doc/`. A página falha no `docs:check` até os comentários do template serem apagados |

## Testar a imagem de produção

O profile `prod` do `docker-compose.yml` gera a imagem, roda as migrations dela e sobe a app na porta 3000. Fica fora do `docker compose up` de sempre. Os comandos estão em [Como fazer o deploy](../how-to/fazer-o-deploy.md#testar-a-imagem-localmente).

## Baixar o ambiente

`docker compose down -v --remove-orphans`, só na raiz do checkout principal. Remove os containers, a rede e os volumes `<pasta>_*`: o Compose usa o nome da pasta do repositório como nome do projeto. Apaga também os dados de todos os worktrees, que usam esse stack. Num worktree, use o `npm run worktree:down` ([Worktrees](#worktrees)). Para voltar a um ambiente limpo e no ar: [Como resetar o ambiente local](../how-to/resetar-o-ambiente-local.md).

Nunca use `docker volume prune` nem `docker system prune`, e não remova volumes, containers ou redes de outros projetos.
