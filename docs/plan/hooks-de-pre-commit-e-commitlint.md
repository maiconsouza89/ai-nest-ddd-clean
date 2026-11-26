# Plano dos hooks de pre-commit e do commitlint (#22)

A issue #22 pede hooks do git que barrem localmente um commit com erro de lint, de formatação ou com mensagem fora do Conventional Commits. O pre-commit roda o Prettier e o ESLint só nos arquivos alterados, com o lefthook ou com o husky e o lint-staged. O `commit-msg` roda o commitlint com o `@commitlint/config-conventional`. A issue pede também avaliar o release-please para gerar o CHANGELOG e as tags. O `docs/reference/comandos.md` passa a explicar os hooks e como pulá-los.

**Mudanças em relação ao texto da issue:**

- **O hook local não protege a `main`.** O merge é só por squash, com o título do PR como mensagem ([CONTRIBUTING](../../.github/CONTRIBUTING.md#commits-e-título-do-pr)). O `commit-msg` confere os commits da branch, que o squash descarta, e nunca vê o título do PR. Um hook também se pula com `--no-verify`. O plano propõe, além do hook, um job `pr-title` no CI que roda o mesmo commitlint sobre o título do PR.
- **Os commits da branch deixam de ser livres.** O CONTRIBUTING diz "Os commits dentro da branch ficam livres". Com o `commit-msg`, cada commit local segue o formato. A frase muda no mesmo PR. Os `fixup!`, `squash!`, `Merge …` e `Revert …` continuam passando: o commitlint os ignora por padrão.
- **O `config-conventional` puro barra mensagens do próprio histórico.** A regra `subject-case` recusa um assunto que começa com maiúscula, como `ci: Dependabot, CodeQL, dependency review e lockfile das actions (#13) (#44)` e `docs: README novo`. A `body-max-line-length` recusa um parágrafo por linha, como o projeto escreve. As duas saem da config. O `type-enum` fica com os nove tipos do CONTRIBUTING, sem `style` e `revert`.
- **O Prettier não olha o Markdown.** O `.prettierignore` tem `*.md` ([ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md)). O pre-commit roda o `markdownlint-cli2` nos `.md` alterados, e o `tsc` e o `arch`, que olham o projeto inteiro, ficam no pre-push.
- **A instalação pelo npm não funciona como a documentação do lefthook descreve.** O npm 11 bloqueia os scripts de instalação das dependências sem `allowScripts`, e o `postinstall` do lefthook não roda (conferido com o npm 11.19.1). Um `"prepare": "lefthook install"` puro quebra o `npm ci` sem `.git` (saída 1) e com `--omit=dev` (saída 127, o lefthook não está instalado): os dois casos do `Dockerfile`. A instalação passa por um script de guarda, e o `Dockerfile` ganha `--ignore-scripts`.
- **O release-please fica fora.** A avaliação está na tabela de decisões e em [Fora do plano](#fora-do-plano).

Tudo entra em **um PR**, na branch `feat/hooks-do-git`. O plano nasce e é apagado no mesmo PR, e o registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-25, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Ferramenta | **lefthook**, e não husky com lint-staged. Um pacote e um `lefthook.yml` para os três hooks, com filtro por glob, `{staged_files}`, `stage_fixed` e jobs em sequência ou em paralelo. Com arquivo parcialmente em stage, ele guarda o que não está em stage num stash ("lefthook auto backup") e o devolve no fim. O ponto que decide é o worktree: o lefthook grava os hooks em `git rev-parse --git-path hooks`, o diretório comum do git, e eles valem em todo worktree desde a criação (conferido com o lefthook 2.2.3 e o git 2.52). O husky 9 grava o `core.hooksPath` como `.husky/_`, caminho relativo e fora do git, que só existe no checkout que rodou o `prepare`: num worktree antes do `npm ci`, o commit passa sem hook e sem aviso. O custo do lefthook: um binário Go por plataforma, nas `optionalDependencies` |
| O que roda no pre-commit | Nos arquivos em stage, em sequência (`piped: true`): o Prettier com `--write`, que põe a correção no stage (`stage_fixed`); o ESLint, sem `--fix`; o `markdownlint-cli2` nos `.md`. Em sequência para o ESLint ler o arquivo já formatado. Medido nesta máquina em 2026-11-25: o ESLint com tipos leva 3,8 s para um arquivo (o tempo é o do programa do TypeScript, quase igual para 5 arquivos), o Prettier menos de 0,5 s, o markdownlint 2 s. O `tsc` não entra: ele confere o projeto inteiro, não os arquivos em stage |
| O que roda no pre-push | `npm run typecheck` (3,6 s) e `npm run arch` (4,9 s), em paralelo. Os unitários e o `npm run ci` inteiro não entram: o `ci:static` e o `test` somaram uns 85 s nesta máquina, e o CI os roda. A alternativa é um pre-push vazio, com os tipos só no CI |
| commitlint também no CI | Sim. Um workflow `.github/workflows/pr-title.yml`, com o job `pr-title`, roda o commitlint sobre o título do PR nos eventos `opened`, `edited`, `synchronize` e `reopened`. O `synchronize` é necessário: o check obrigatório vale por commit, e um push sem ele deixaria o PR esperando. O `pr-title` entra nos `REQUIRED_CHECKS` do `scripts/setup-github.mjs`, o que pede `npm run github:setup` depois do merge |
| `scope-enum` | Não entra. O CONTRIBUTING define o escopo como "o módulo ou a área", uma lista aberta, e o histórico tem uns vinte escopos (`identity`, `tracing`, `deploy`, `dev`, `plan`, `deps`, `deps-dev`…). Uma lista fechada pediria uma linha na config a cada área nova. Fica a regra padrão `scope-case` em minúsculas |
| release-please | Fora. O PR de release aberto com o `GITHUB_TOKEN` não dispara outros workflows, então o check obrigatório `ci` nunca roda nele e o PR não entra sem um PAT ou um GitHub App com segredo no repositório. Pede também `contents: write` e `pull-requests: write` e a opção "Allow GitHub Actions to create and approve pull requests", o que alarga a superfície da [ADR 0012](../adr/0012-cadeia-de-suprimentos-do-ci.md). Num template, o CHANGELOG e o workflow de release viriam junto para quem copia o código. O repositório não tem tag nem release, e o CONTRIBUTING define a release como manual. Vai para Evoluções com gatilho |
| Instalação dos hooks | `"prepare": "node scripts/install-git-hooks.mjs"`. O script não faz nada com `CI` ligado, com `LEFTHOOK=0`, sem `.git` na raiz e num worktree linkado (o `.git` é um arquivo), e nesses casos diz por quê. Fora disso, roda `lefthook install`. Uma falha (um `core.hooksPath` global, por exemplo) vira aviso, e o `npm install` não quebra. O worktree fica de fora porque os hooks moram no diretório comum e quem os instala é o checkout principal: assim o hook aponta para o binário do `node_modules` do principal, que sobrevive à remoção de um worktree |
| `allowScripts` do lefthook | `npm install-scripts deny lefthook`, que grava `"allowScripts": { "lefthook": false }` no `package.json`. A instalação já é do `prepare`, e a negação tira o lefthook do aviso de scripts não aprovados. Aprovar o `postinstall` em vez do `prepare` foi descartado: a aprovação padrão fixa a versão (`lefthook@2.2.3`), e o PR do Dependabot que sobe o pacote a deixaria vencida, sem aviso |
| `Dockerfile` | `npm ci --ignore-scripts` nos dois estágios. O `scripts/install-git-hooks.mjs` não está no contexto do build (o `.dockerignore` é lista de permitidos), e o `npm ci` roda antes de qualquer `COPY` de código. Nenhuma dependência roda script hoje na imagem, porque o npm 11 já bloqueia os não aprovados: o efeito é só não rodar o `prepare` |
| `worktree:setup` | Sem mudança. Os hooks valem no worktree desde a criação, e o `npm ci` do setup roda o `prepare`, que pula o worktree. Antes do setup, sem `node_modules`, o hook falha com erro do `npx`: o `AGENTS.md` já manda rodar o setup antes de qualquer comando |
| Como os jobs chamam as ferramentas | `npx --no -- <ferramenta>`. O `--no` impede o `npx` de baixar o pacote quando falta o `node_modules`, e o hook falha com erro em vez de rodar uma versão qualquer |
| Flags do ESLint | `--max-warnings 0 --no-warn-ignored`. Sem o `--no-warn-ignored`, uma migration ou o `vitest.config.ts` em stage geram o aviso "File ignored", e o `--max-warnings 0` barra o commit (conferido). Sem `--cache`: o cache do ESLint não enxerga a mudança de tipo vinda de outro arquivo |
| Flags do Prettier e do markdownlint | Prettier com `--write --ignore-unknown`, sem glob no job: o `--ignore-unknown` pula o que ele não formata (`Dockerfile`, `.gitignore`), e o `.prettierignore` vale para os arquivos passados por argumento. `markdownlint-cli2` com `--no-globs`: sem ele, o `globs` do `.markdownlint-cli2.jsonc` soma `**/*.md` aos argumentos e o lint roda nos 66 arquivos |
| Glob do lefthook | `glob_matcher: doublestar`. No padrão (`gobwas`), `**/*.ts` não casa um arquivo na raiz |
| Merge e rebase | O pre-commit pula o estado de merge e de rebase (`skip: [merge, rebase]`): o commit de merge traz arquivos que já passaram pela outra branch. O commitlint ignora o `Merge …` por padrão |
| Regras do commitlint | `commitlint.config.mjs` em ESM, com `extends: ['@commitlint/config-conventional']` e: `type-enum` com `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`, `ci` e `chore`; `subject-case`, `body-max-line-length` e `footer-max-line-length` desligadas; `header-max-length` em 100, o padrão. Com essa config, 59 das 60 últimas mensagens da `main` passam; a que falha tem 101 caracteres. O GitHub acrescenta o número do PR, `(#<PR>)`, ao fim do título no squash, e o cabeçalho na `main` pode chegar a 106. Um `helpUrl` aponta para a seção "Commits e título do PR" do CONTRIBUTING. O `!` e o `BREAKING CHANGE:` passam (conferido) |
| Dependabot | Os títulos `build(deps): bump …`, `build(deps-dev): bump …` e `ci(deps): bump …` passam no commitlint (conferido). Os commits dele não passam por hook local. Um grupo `commitlint` (`@commitlint/*`) no `dependabot.yml`, para o `cli` e o `config-conventional` subirem juntos |
| Agentes de código | O Claude Code roda o `git commit` pelo shell, e os hooks valem para ele. A falha volta como saída do comando, e o agente corrige e faz um commit novo. O `stage_fixed` muda o arquivo no disco: o `AGENTS.md` ganha uma armadilha para o agente reler o arquivo antes de editá-lo de novo e não pular os hooks |
| `lefthook-local.yml` | No `.gitignore`. É o arquivo de ajuste pessoal do lefthook (pular um job na própria máquina, por exemplo), mesclado ao `lefthook.yml` |
| Versões | A latest com `^`: `lefthook` 2.2.3, `@commitlint/cli` e `@commitlint/config-conventional` 21.2.4, em 2026-11-25. O lefthook 2.2.3 saiu no mesmo dia: na execução, confira de novo com `npm view` |
| ADR | Uma ADR 0013, "Hooks do git com lefthook e commitlint no título do PR", com as alternativas descartadas (husky com lint-staged, só CI, `tsc` e testes no pre-commit, release-please). A escolha é de ferramenta, como a [ADR 0004](../adr/0004-lint-e-formatacao.md). Se outro PR da onda 2 usar o número 0013 antes, pegue o próximo livre no rebase |
| Tipo do commit e do PR | `feat(dev)`, como o dos worktrees (#35): comportamento novo no fluxo de quem contribui. Sem `!`: nenhum contrato, comando ou variável de quem usa o template muda |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| release-please (CHANGELOG, versão e tag a partir dos commits) | Linha em Evoluções com gatilho, tabela CI. Gatilho: o template passar a publicar releases com frequência, ou alguém pedir um CHANGELOG. O que fazer: release-please com o token de um GitHub App, para o `ci` rodar no PR de release, e um passo no "Usar como template" do `README.md` para quem copia apagar o CHANGELOG. O commitlint deste plano já garante o formato que ele lê |
| Unitários no pre-push | Linha em Evoluções com gatilho, tabela CI. Gatilho: PRs chegarem ao CI com unitário quebrado com frequência. O que fazer: `npm test -- --changed origin/main` no pre-push |
| Lint de todos os commits da branch no CI | Nenhum. O squash descarta esses commits, e o `pr-title` confere o que chega à `main` |
| Prompt interativo de mensagem (`@commitlint/prompt-cli`, commitizen) | Nenhum |
| Opção `ai` do lefthook, que gera configuração para agentes no `lefthook install` | Não usar. As instruções de agente ficam só no `AGENTS.md` ([ADR 0007](../adr/0007-agents-md-como-unico-arquivo-de-instrucoes.md)) |
| Build da imagem no CI | Já tem linha em Evoluções com gatilho ("Um job `docker` no CI"). O `--ignore-scripts` do `Dockerfile` se confere à mão no passo 2 |

## Referências

- Issue #22: `gh issue view 22`.
- Consultados no Context7 em 2026-11-25:
  - lefthook, `/evilmartians/lefthook`: `docs/usage/envs/CI.md` e `LEFTHOOK.md` (`CI=true` pula o `postinstall`, `LEFTHOOK=0` pula os hooks), `docs/usage/commands/install.md` (o `postinstall` para com um `core.hooksPath` definido), `docs/configuration/stage_fixed.md`, `glob.md`, `glob_matcher.md`, `skip.md` e `jobs.md`, e `internal/git/wrapper/store_stash.go` (o stash das mudanças fora do stage, com o nome do diretório num worktree).
  - husky, `/typicode/husky`: `docs/how-to.md` ("CI server and Docker": o `prepare` falha com `--omit=dev`, e a saída é um `.husky/install.mjs`) e o `index.js` (o `core.hooksPath` relativo, `.husky/_`).
  - commitlint, `/conventional-changelog/commitlint`: o README do `@commitlint/config-conventional` (regras e valores) e `docs/reference/configuration.md` (config em `.mjs`, `defaultIgnores`, `helpUrl`).
  - release-please, `/googleapis/release-please-action`: README, seção "GitHub Credentials" (o PR do `GITHUB_TOKEN` não dispara workflows, as permissões e a opção do repositório).
- `npm view` em 2026-11-25: `lefthook` 2.2.3 (publicado em 2026-11-25, `engines` `>=22.12.0`, `postinstall: node postinstall.js`), `@commitlint/cli` e `@commitlint/config-conventional` 21.2.4 (`>=22.12.0`), `husky` 9.1.7 (de 2024-11-18), `lint-staged` 17.6.2, `release-please` 17.11.2.
- Conferido à mão em 2026-11-25, num repositório de rascunho, com o npm 11.19.1, o Node 24.22.2 e o git 2.52.0:
  - o `postinstall` do lefthook não roda sem `allowScripts`, e o `prepare` da raiz roda;
  - `"prepare": "lefthook install"` faz o `npm ci` sair com 1 sem `.git` e com 127 com `--omit=dev`;
  - o hook instalado no principal roda num worktree recém-criado, com a config do worktree;
  - numa branch sem `lefthook.yml`, o hook avisa que não achou a config e deixa o commit passar;
  - o hook grava o caminho absoluto do binário do `node_modules` de quem rodou o `install`, com o `node_modules` da raiz do checkout como alternativa.
- Código e config: `package.json`, `Dockerfile`, `.dockerignore`, `.gitignore`, `.prettierignore`, `.markdownlint-cli2.jsonc`, `eslint.config.mjs`, `.github/dependabot.yml`, `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `scripts/setup-github.mjs`, `scripts/worktree.mjs`, `scripts/worktree-guard.mjs`.
- Páginas a mudar: `docs/reference/comandos.md` (Setup do zero, uma seção nova "Hooks do git", Worktrees e CI), `.github/CONTRIBUTING.md`, `AGENTS.md` (Armadilhas), `README.md` (os checks do passo 4 de "Usar como template"), `docs/reference/versoes-e-excecoes.md` (Atualização automática), `docs/reference/evolucoes-com-gatilho.md` (CI), `docs/adr/0013-…` e o índice do `docs/README.md`.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): `package.json` e `package-lock.json` com várias; `docs/reference/comandos.md`, `.github/CONTRIBUTING.md` e `scripts/setup-github.mjs` com a #21 e a #23; o `Dockerfile` com a #17. A ordem de merge põe a #22 junto da #21 e da #23, depois da #17: faça rebase sobre a `main` antes do PR, refaça o lockfile com `npm install` e rode `gh actions-lock` de novo.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal, com data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR, comentário na issue e `npm run github:setup` só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Dependências, instalação dos hooks e `Dockerfile` | ✅ |
| 3 | `lefthook.yml` e `commitlint.config.mjs` | ✅ |
| 4 | Job `pr-title` no CI e grupo do Dependabot | ✅ |
| 5 | Documentação e ADR 0013 | ✅ |
| 6 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha F com a branch `feat/hooks-do-git` e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Traga este plano para a branch.
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #22 como 🟡. Em "Arquivos em comum", acrescente o que este plano toca além do `package.json` e do `comandos.md`: `.github/CONTRIBUTING.md` e `scripts/setup-github.mjs` (com a #21 e a #23), o `Dockerfile` (com a #17) e o `.github/workflows/actions.lock` (com a #21 e a #23).
4. Commit: `docs(plan): plano dos hooks de pre-commit e do commitlint (#22)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: dependências, instalação dos hooks e `Dockerfile`

1. Confira as latests com `npm view lefthook version` e `npm view @commitlint/cli version`, e instale: `npm install --save-dev lefthook@latest @commitlint/cli@latest @commitlint/config-conventional@latest`.
2. `npm install-scripts deny lefthook`. Confira que o `package.json` ganhou `"allowScripts": { "lefthook": false }` e que o `npm install` seguinte não lista o lefthook no aviso.
3. `scripts/install-git-hooks.mjs`, em JS puro, como os outros scripts (o `eslint.config.mjs` já cobre `scripts/**/*.mjs`):
   - um comentário no topo diz o que o script faz e aponta para a seção "Hooks do git" do `comandos.md`;
   - sai com 0, e com uma linha dizendo por quê, quando: o `CI` está ligado (fora de `0` e `false`, a regra do `postinstall` do lefthook), o `LEFTHOOK` é `0`, não existe `.git` na raiz, ou o `.git` é um arquivo (worktree linkado, a mesma checagem do `worktree-guard.mjs`);
   - fora disso, roda `lefthook install` pelo binário do `node_modules` (`spawnSync`, sem shell). Se o binário não existe ou o comando falha, imprime um aviso com o comando para rodar à mão e sai com 0.
4. `package.json`: `"prepare": "node scripts/install-git-hooks.mjs"`.
5. `Dockerfile`: `--ignore-scripts` nos dois `npm ci`. Acrescente ao comentário de cada um por quê: o `prepare` instala hooks do git, e o script dele não está no contexto do build.
6. `.gitignore`: `lefthook-local.yml`.
7. Confira:
   - no worktree, `npm ci` imprime a linha do worktree e não toca em `.git/hooks`;
   - `CI=true npm ci` imprime a linha do CI;
   - `docker build -t ai-nest-ddd-clean:hooks-check .` termina, e `docker image rm ai-nest-ddd-clean:hooks-check` depois. Só o build: nada de `docker compose` com o profile `prod`, que num worktree para o stack de todos;
   - `npm run audit:signatures` passa com os pacotes novos;
   - `npm run lint` passa com o script novo.
8. Commit: `build(deps): lefthook e commitlint, com os hooks instalados pelo prepare (#22)`.

### Passo 3: `lefthook.yml` e `commitlint.config.mjs`

1. `lefthook.yml` na raiz. Formato sugerido:

   ```yaml
   # Hooks do git e como pulá-los: docs/reference/comandos.md#hooks-do-git
   glob_matcher: doublestar

   pre-commit:
     piped: true
     skip: [merge, rebase]
     jobs:
       - name: prettier
         tags: [prettier]
         run: npx --no -- prettier --write --ignore-unknown {staged_files}
         stage_fixed: true
       - name: eslint
         tags: [eslint]
         glob: '**/*.{ts,mts,cts,js,mjs,cjs}'
         run: npx --no -- eslint --max-warnings 0 --no-warn-ignored {staged_files}
       - name: markdownlint
         tags: [markdownlint]
         glob: '**/*.md'
         run: npx --no -- markdownlint-cli2 --no-globs {staged_files}

   commit-msg:
     jobs:
       - name: commitlint
         tags: [commitlint]
         run: npx --no -- commitlint --edit {1}

   pre-push:
     parallel: true
     jobs:
       - name: typecheck
         tags: [typecheck]
         run: npm run typecheck
       - name: arch
         tags: [arch]
         run: npm run arch
   ```

   Cada job tem uma tag com o próprio nome: o `LEFTHOOK_EXCLUDE` pula por tag, e por nome só nos `commands` (documentação do `LEFTHOOK_EXCLUDE`). Confira na documentação do lefthook (Context7) que o `skip` e o `piped` valem no nível do hook com `jobs`, e ajuste se não.
2. `commitlint.config.mjs` na raiz, com `export default` e o tipo em JSDoc (`/** @type {import('@commitlint/types').UserConfig} */`), com as regras da tabela de decisões. Um comentário diz que a lista de tipos espelha o CONTRIBUTING e que uma mudança lá muda a config no mesmo PR.
3. `npm run format` e `npm run lint`: o Prettier formata o YAML e o `.mjs` novos.
4. Instale os hooks à mão: `npx lefthook install`. O comando grava no `.git/hooks` comum, e os hooks passam a valer no principal e em todo worktree. Numa branch sem `lefthook.yml`, o hook só avisa que não achou a config e deixa o commit passar. Avise o dono, se houver outras trilhas abertas em paralelo.
5. Confira, num commit de teste que você desfaz depois (`git reset --soft HEAD~1` ou `git restore --staged`):
   - um `.ts` com erro do ESLint (uma promise sem `await`) barra o commit;
   - um `.ts` mal formatado entra formatado, e o `git diff --cached` mostra a formatação;
   - com um arquivo parcialmente em stage, a parte fora do stage continua no disco depois do commit;
   - uma migration e o `vitest.config.ts` em stage não barram o commit;
   - um `.md` com erro do markdownlint barra o commit;
   - um commit que só apaga um arquivo passa;
   - `git commit -m "atualiza coisas"` é barrado, e `git commit -m "chore: atualiza coisas"` passa;
   - `LEFTHOOK=0 git commit …` e `git commit --no-verify …` pulam os hooks;
   - `git push --dry-run` roda o typecheck e o arch;
   - num worktree de teste sem `node_modules` (`git worktree add`, sem o setup), o commit falha com o erro do `npx`. Remova o worktree com `git worktree remove` depois;
   - as 60 últimas mensagens da `main` passam no commitlint, fora a de 101 caracteres: `git log --format=%B%x00 -60` e um laço que manda cada uma para `npx commitlint`;
   - os títulos do Dependabot passam: `build(deps): bump the nestjs group with 4 updates`, `build(deps-dev): bump typescript-eslint from 8.74.0 to 8.75.0 in the typescript-eslint group` e `ci(deps): bump the actions group across 2 directories with 3 updates`.
6. Commit: `feat(dev): hooks de pre-commit, commit-msg e pre-push com lefthook e commitlint (#22)`. O próprio commit passa pelos hooks.

### Passo 4: job `pr-title` no CI e grupo do Dependabot

1. `.github/workflows/pr-title.yml`:
   - um comentário no topo diz o que confere, aponta para a seção CI do `comandos.md` e avisa que o `scripts/setup-github.mjs` exige o check pelo nome do job, como o `dependency-review.yml`;
   - `on: pull_request` com `types: [opened, edited, synchronize, reopened]`, `permissions: contents: read` e `concurrency` por PR com `cancel-in-progress`;
   - job `pr-title`: `actions/checkout` (com `persist-credentials: false`), a composite `.github/actions/setup` com o `.nvmrc`, como o `ci.yml`, e um step com `printf '%s\n' "$PR_TITLE" | npx --no -- commitlint --verbose`;
   - o título entra por `env: PR_TITLE: ${{ github.event.pull_request.title }}`, nunca interpolado no `run:`. Interpolado, um título vira comando no shell, e o CodeQL de actions acusa.
2. `gh actions-lock` e commite o `.github/workflows/actions.lock`.
3. `scripts/setup-github.mjs`: `pr-title` em `REQUIRED_CHECKS`, e o comentário de cima cita o `pr-title.yml`.
4. `.github/dependabot.yml`: grupo `commitlint` com `patterns: ['@commitlint/*']` no ecossistema `npm`.
5. Commit: `ci: commitlint no título do PR (#22)`.

### Passo 5: documentação e ADR 0013

1. `docs/reference/comandos.md`:
   - **Setup do zero, item 1:** o `npm install` instala os hooks do git pelo `prepare` (link para a seção nova).
   - **Seção nova "Hooks do git"**, depois de Verificação. Uma tabela com o hook, o que roda e em quais arquivos, e depois:
     - como pular: `git commit --no-verify` e `git push --no-verify`, ou `LEFTHOOK=0` para tudo; `LEFTHOOK_EXCLUDE=<tag>` para um job só (a tag de cada job é o nome dele); o `lefthook-local.yml` para um ajuste na própria máquina;
     - a instalação: o `prepare` roda o `scripts/install-git-hooks.mjs`, que não faz nada no CI, sem `.git` e num worktree; para reinstalar, `npx lefthook install`;
     - o que o hook não confere e o CI confere: os testes, o `format:check` e o `docs:check` do projeto inteiro, e o título do PR.
   - **Worktrees:** os hooks são do checkout principal e valem em todo worktree; antes do `worktree:setup`, o commit falha por falta do `node_modules`.
   - **CI:** uma linha para o `pr-title.yml` na tabela de workflows, e o `pr-title` na lista dos checks obrigatórios.
2. `.github/CONTRIBUTING.md`, seção "Commits e título do PR":
   - a frase "Os commits dentro da branch ficam livres" sai: o hook `commit-msg` confere cada commit, e o job `pr-title` confere o título do PR;
   - as regras ficam no `commitlint.config.mjs`, e uma mudança nos tipos muda os dois arquivos;
   - o assunto pode começar com maiúscula quando a palavra é um nome próprio (`ci: Dependabot …`), e o cabeçalho tem até 100 caracteres antes do `(#<PR>)` que o squash acrescenta.
3. `AGENTS.md`, Armadilhas: uma linha sobre os hooks. O pre-commit reformata com o Prettier e põe a correção no stage: releia o arquivo antes de editá-lo de novo. Não pule os hooks (`--no-verify`, `LEFTHOOK=0`) sem o ok do dono: corrija o que eles apontam.
4. `README.md`, passo 4 de "Usar como template": o `pr-title` entra na lista dos checks exigidos.
5. `docs/reference/versoes-e-excecoes.md`, Atualização automática: o grupo `commitlint` na coluna Grupos do `npm`.
6. `docs/reference/evolucoes-com-gatilho.md`, tabela CI: as duas linhas de [Fora do plano](#fora-do-plano) (release-please e unitários no pre-push), com o contexto apontando para a ADR 0013.
7. `docs/adr/0013-hooks-do-git-com-lefthook-e-commitlint.md`, no formato das ADRs novas (`status: accepted`, "Considered Options" e "Consequences"):
   - a decisão: lefthook para os três hooks, o commitlint local e no título do PR, e o CI como fonte de verdade, porque os hooks se pulam;
   - Considered Options: husky com lint-staged (o `core.hooksPath` relativo e os worktrees), só o CI, o `tsc` e os testes no pre-commit (o tempo), o `postinstall` do lefthook aprovado em `allowScripts` (a aprovação vencida pelo Dependabot) e o release-please (o token e o template);
   - Consequences: o `--ignore-scripts` no `Dockerfile`, o `prepare` que nunca quebra o `npm install`, os hooks comuns aos worktrees.
8. `docs/README.md`: a ADR 0013 no índice de Decisões.
9. `npm run docs:check`.
10. Commit: `docs(dev): hooks do git, commitlint no título do PR e ADR 0013 (#22)`.

### Passo 6: verificação, revisão, registro e PR

1. `npm run ci`. A mudança não toca banco, Redis, filas nem HTTP: `test:int` e `test:e2e` ficam de fora.
2. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar o `lefthook.yml`, o `commitlint.config.mjs`, o script de instalação ou o `Dockerfile`, repita a conferência do passo correspondente.
3. Faça rebase sobre a `main`, refaça o lockfile com `npm install` se houver conflito nele, rode `gh actions-lock` de novo e `npm run ci`.
4. Com o ok do dono: push e PR com o título `feat(dev): hooks de pre-commit e commitlint (#22)`. O job `pr-title` do próprio PR confere o título. A descrição traz:
   - as mudanças em relação à issue: o `pr-title` no CI, os commits da branch que deixam de ser livres, as regras do commitlint que saem, o markdownlint no lugar do Prettier para o Markdown, a instalação pelo `prepare` e o `--ignore-scripts` no `Dockerfile`, e o release-please fora;
   - os tempos medidos de cada hook;
   - como pular os hooks;
   - que quem já tem o clone roda `npm install` depois do merge para instalar os hooks;
   - que, depois do merge, o dono roda `npm run github:setup` para o `pr-title` virar obrigatório. Antes do merge, o ruleset exigiria um check que os PRs abertos sem o workflow não publicam, e eles ficariam parados até o rebase.
5. Com o ok do dono: comentário de registro na issue, com este plano e os mesmos pontos da descrição.
6. Último commit da branch (`docs(plan): fecha o plano dos hooks de pre-commit e do commitlint (#22)`):
   - apague este plano;
   - no roadmap, marque a #22 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #22, como os das issues #19 e #15;
   - rode `npm run docs:check` de novo e faça push.
