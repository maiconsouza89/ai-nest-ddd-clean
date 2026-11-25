# Plano da cadeia de suprimentos do CI: Dependabot, CodeQL, dependency review e lockfile das actions (#13)

A issue #13 pede atualização automática de dependências, análise de segurança no CI e as actions fixadas. Hoje a conferência de versões é manual (`npm outdated`), o CI não tem CodeQL, dependency review nem auditoria, as actions são referenciadas por tag (`actions/checkout@v7`), e no repositório os Dependabot alerts, os security updates e o secret scanning estão desligados.

**Mudança em relação ao texto da issue:** ela pede as actions "fixadas por SHA". O guia oficial de uso seguro do GitHub Actions, conferido em 2026-11-25, agora põe o **workflow lockfile** (`.github/workflows/actions.lock`, GA desde 2026-10-28) como a proteção mais forte. Segundo o guia, ele "supersedes SHA pinning", e o SHA no `uses:` fica para quem não pode adotar o lockfile. O plano adota o lockfile, que cumpre o objetivo da issue (seguir o guia de hardening). A descrição do PR e o registro na issue explicam a troca.

Tudo entra em **um PR**, com um commit por entrega dentro da branch. O título será `ci: Dependabot, CodeQL, dependency review e lockfile das actions (#13)`. A fase 2 só roda depois do merge, porque o Dependabot lê o config da branch padrão e as mudanças de ruleset e de política travariam os PRs abertos de outras trilhas.

As decisões abaixo foram fechadas antes do plano, numa sessão de perguntas com o dono do repositório, e revalidadas contra a documentação oficial. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Ferramenta de atualização | Dependabot, não Renovate: um template não deve exigir app de terceiro com escrita no repositório |
| Entrega | Um PR, com um commit por entrega, na branch `ci/dependabot-codeql-e-lockfile-das-actions` |
| CodeQL | Advanced setup (`.github/workflows/codeql.yml`), não o default setup: a config fica versionada e é revisada em PR. Linguagens `javascript-typescript` e `actions`, com `build-mode: none`. Gatilhos: `pull_request`, `push` na `main` e `schedule` semanal. Suíte `default`, sem `paths-ignore`. Permissões do starter oficial, no job: `security-events: write`, `packages: read`, `actions: read`, `contents: read` |
| CodeQL barra o merge | Regra `code_scanning` no ruleset: ferramenta `CodeQL`, `security_alerts_threshold: high_or_higher`, `alerts_threshold: errors`. O `setup-github.mjs` pula a regra, e avisa, quando o code scanning não está disponível (repo privado sem GitHub Code Security) |
| Dependency review | Workflow próprio (`.github/workflows/dependency-review.yml`), com o check `dependency-review` obrigatório no ruleset. `fail-on-severity: high`, `allow-licenses` gerada da árvore atual (mais `allow-dependencies-licenses` para exceções por pacote) e `comment-summary-in-pr: on-failure`. `pull-requests: write` só nesse job |
| Pinagem das actions | Workflow lockfile pela extensão `github/gh-actions-lock` (v0.5.1), com `--migrate-local-actions` para a composite `.github/actions/setup`. Nada de SHA à mão no `uses:` |
| Obrigar o lockfile | `sha_pinning_required: true` e o check `verify-lockfile` obrigatório, os dois pelo `setup-github.mjs`. Mais a política "Require lockfile" ligada à mão pela interface (Settings → Actions → Policies): a REST API de políticas não tem essa regra |
| Ecossistemas do Dependabot | `npm` (`/`), `github-actions` (`directories: ["/", "/.github/actions/*"]`) e `docker-compose` (`/`). O Node (`.nvmrc` e o `ARG NODE_VERSION` do Dockerfile) fica de fora e é conferido à mão |
| `ignore` | Na granularidade da tabela de exceções: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` e `@nestjs/testing` só em `versions: ["12.6.1"]`, `typescript` em `versions: [">=6.1.0"]`, e `keyv`, `@keyv/redis` e `ioredis` em `update-types: ["version-update:semver-major"]`. O `argon2` fica sem ignore. Cada entrada com comentário e link para a linha da tabela |
| Grupos | No npm: `nestjs` (`@nestjs/*`), `opentelemetry` (`@opentelemetry/*`), `testcontainers` (`testcontainers`, `@testcontainers/*`), `typescript-eslint` (`typescript-eslint`, `@typescript-eslint/*`) e `vitest` (`vitest`, `@vitest/*`), com todos os tipos de update. O resto vem avulso. Nas actions, um grupo `actions`. As imagens ficam avulsas |
| Título dos PRs | `commit-message.prefix: build` + `include: scope` no npm e no compose, `prefix: ci` + `include: scope` nas actions. O texto depois do prefixo sai em inglês, e a exceção fica no CONTRIBUTING |
| Agenda | `weekly`, `monday`, `06:00`, `America/Sao_Paulo`, nos três ecossistemas |
| Cooldown | npm: `semver-patch-days: 3`, `semver-minor-days: 3`, `semver-major-days: 7`. Actions e compose: `default-days: 3`. Não vale para os security updates |
| Limite de PRs | `open-pull-requests-limit: 10` no npm, o padrão (5) nos outros |
| Faixas do `package.json` | `versioning-strategy: increase` no npm, como fez o PR #38 |
| Imagens | O PR do Dependabot só muda o `docker-compose.yml`. Quem o fecha completa as outras ocorrências na mesma branch (lista no passo 8). Numa major do Postgres, é preciso recriar o volume |
| Configuração do repo | O `setup-github.mjs` liga os Dependabot alerts e os security updates |
| Auditoria | `npm audit signatures` num script `audit:signatures`, num step próprio do job `check`, fora do `ci:static`. Sem `npm audit --audit-level`, que deixaria o check obrigatório instável por advisory alheio ao PR |
| ADR | `docs/adr/0012-cadeia-de-suprimentos-do-ci.md` com o porquê das escolhas e as alternativas descartadas |
| `AGENTS.md` | A rota nova "Mexer num workflow ou action do CI, no Dependabot, no CodeQL ou no dependency review". Em "Versões", a frase sobre manter o `ignore` em sincronia. A armadilha "**Actions:** depois de adicionar ou mudar um `uses:`, rode `gh actions-lock` e commite o `actions.lock`; nunca edite o lockfile à mão" |
| Fechamento da issue | Depois da primeira rodada de segunda-feira do Dependabot, com PR aberto ou não. As tarefas pós-merge vão no comentário de registro da issue |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Secret scanning e push protection | Issue nova, aberta com o ok do dono no passo 14 |
| zizmor nos workflows | `evolucoes-com-gatilho.md`, com gatilho "um workflow novo com `pull_request_target`, `workflow_run` ou action composite de terceiro" |
| Node pelo Dependabot | Conferência manual, escrita no `versoes-e-excecoes.md` |
| Script que confere se as imagens batem nos vários arquivos | Não entra: a troca de major acontece uma vez por ano por imagem |
| `npm audit --audit-level` | Alternativa descartada, registrada na ADR |
| As 5 vulnerabilidades `moderate` de produção de hoje (`npm audit --omit=dev`, 2026-11-25) | Ficam para os alerts e os security updates, depois do passo 10 |
| actionlint no CI | Continua só local (`.github/actionlint.yaml`). O CodeQL `actions` cobre a parte de segurança |
| Regra `code_coverage` do ruleset | Anotada para a #21 |

## Referências

Consultadas em 2026-11-25.

| Assunto | Fonte | Tipo |
| --- | --- | --- |
| Opções do `dependabot.yml`: `directories` (globs), `groups`, `ignore`, `cooldown`, `commit-message`, `schedule`, `versioning-strategy`, ecossistema `docker-compose` | <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference> | Oficial |
| Dependabot nas Actions: atualiza o comentário de versão na mesma linha e ignora `./` local; sem alerta para action fixada por SHA | <https://docs.github.com/en/actions/reference/security/secure-use> | Oficial |
| PR do Dependabot: token só de leitura, elevável por `permissions:`; só Dependabot secrets | <https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions> | Oficial |
| Lockfile como a proteção mais forte, acima do SHA | <https://docs.github.com/en/actions/reference/security/secure-use> | Oficial |
| Lockfile: conceito, comparação com SHA, o que cobre | <https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles> | Oficial |
| Gerar o lockfile, `--migrate-local-actions`, manter atualizado | <https://docs.github.com/en/actions/how-tos/secure-your-work/lock-workflow-dependencies> | Oficial |
| Obrigar o lockfile, check `--verify` no PR, CODEOWNERS | <https://docs.github.com/en/actions/how-tos/administer/enforce-workflow-lockfiles> | Oficial |
| Política "Require lockfile" e a convivência com o `sha_pinning_required` | <https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution> | Oficial |
| Extensão, modos (`--verify`, `--verify-local`) e o `verify-lockfile.yml` de referência | <https://github.com/github/gh-actions-lock> | Oficial |
| REST: `sha_pinning_required` em `PUT /repos/{owner}/{repo}/actions/permissions` (`enabled` obrigatório) | <https://docs.github.com/en/rest/actions/permissions> | Oficial |
| REST: políticas de Actions só com `restrict_actions_actors` e `restrict_action_events` | <https://docs.github.com/en/rest/actions/policies> | Oficial |
| REST: `PUT /repos/{owner}/{repo}/vulnerability-alerts` e `PUT /repos/{owner}/{repo}/automated-security-fixes` | <https://docs.github.com/en/rest/repos/repos> | Oficial |
| REST: regra `code_scanning` do ruleset (`code_scanning_tools`, `alerts_threshold`, `security_alerts_threshold`) | <https://docs.github.com/en/rest/repos/rules> | Oficial |
| Merge protection do code scanning: barra com análise em andamento ou ferramenta não configurada; só alertas em linhas do diff | <https://docs.github.com/en/code-security/concepts/code-scanning/merge-protection> | Oficial |
| CodeQL advanced: gatilhos, suítes, identificadores de linguagem (`actions`, `javascript-typescript`) | <https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning> | Oficial |
| Workflow inicial do CodeQL (permissões, matriz, `codeql-action` v4) | <https://github.com/actions/starter-workflows/blob/main/code-scanning/codeql.yml> | Oficial |
| Default setup desativa o advanced | <https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning> | Oficial |
| Dependency review: só barra se o check for obrigatório; required workflow só em organização | <https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review> | Oficial |
| `dependency-review-action` v5: entradas, `deny-licenses` depreciado, licença não detectada não falha | <https://github.com/actions/dependency-review-action> | Oficial |
| Sem permissão para comentar, a action só dá `warning` (`src/comment-pr.ts`) | <https://github.com/actions/dependency-review-action/blob/main/src/comment-pr.ts> | Código |
| `npm audit signatures`: assinaturas do registry e attestations; recomenda o npm mais recente | <https://docs.npmjs.com/cli/v11/commands/npm-audit> | Oficial |
| Schema do `dependabot.yml` (já tem `cooldown`, `docker-compose`, `directories`, `versioning-strategy`) | <https://json.schemastore.org/dependabot-2.0.json> | Comunidade |

Versões conferidas em 2026-11-25. O `gh actions-lock` resolve os commits; não fixe SHA à mão:

| Action ou ferramenta | Versão |
| --- | --- |
| `actions/checkout` | v7.0.1 |
| `actions/setup-node` | v7.1.0 |
| `actions/cache` | v6.1.0 |
| `github/codeql-action` | v4.39.5 |
| `actions/dependency-review-action` | v5.0.1 |
| `github/gh-actions-lock` | v0.5.1 |

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**. O **Pronto quando** é o critério de aceite: o passo só é marcado quando todos os itens dele forem conferidos.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. As mais usadas aqui: `docs/reference/comandos.md`, `docs/reference/versoes-e-excecoes.md`, `docs/reference/evolucoes-com-gatilho.md`, `docs/README.md` e `.github/CONTRIBUTING.md`.
- Antes de usar uma action, opção ou endpoint que o repositório ainda não usa, confira a fonte da tabela de referências. As actions e o GitHub não estão no Context7. Diga no **Como ficou** qual fonte foi usada.
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Push, abertura de PR, comentário em issue e mudança de configuração do repositório no GitHub só com o ok do dono do repositório.
- O plano nasce e é apagado no mesmo PR (passo 9). O registro e o checklist da fase 2 ficam num comentário da issue #13, como nas #35, #18, #14, #11 e #10.

## Mapa

| Fase | O que entrega | Status |
| --- | --- | --- |
| 1. PR | Lockfile, Dependabot, CodeQL, dependency review, `audit:signatures`, `setup-github.mjs` e documentação | 🟡 |
| 2. Depois do merge | Configuração do repo, "Require lockfile", triagem do CodeQL, primeira rodada do Dependabot e fechamento da issue | ⬜ |

---

## Fase 1: PR

> **Status:** 🟡 Em andamento · **Início:** 2026-11-25 · **Conclusão:** —
>
> - [x] Passo 1: branch, plano e roadmap
> - [x] Passo 2: lockfile das actions e `verify-lockfile.yml`
> - [ ] Passo 3: `.github/dependabot.yml`
> - [ ] Passo 4: CodeQL
> - [ ] Passo 5: dependency review
> - [x] Passo 6: `audit:signatures`
> - [x] Passo 7: `setup-github.mjs`
> - [x] Passo 8: documentação
> - [ ] Passo 9: verificação, entrega e PR

### Passo 1: branch, plano e roadmap

**Por quê:** o roadmap pede para marcar o início da issue e cita "fixa as actions do `ci.yml` por SHA", que a decisão do lockfile mudou. As trilhas #21 e #23 precisam saber que vão mexer no `actions.lock`.

**Faça:**

- Crie a branch `ci/dependabot-codeql-e-lockfile-das-actions` a partir da `main` atualizada. O roadmap manda usar um worktree por trilha (`npm run worktree:setup`). Decida isso na hora, conforme houver outra trilha em paralelo.
- Commite este plano.
- No `docs/plan/roadmap-das-issues-abertas.md`:
  - marque a #13 como 🟡;
  - na tabela de decisões, troque "que fixa as actions do `ci.yml` por SHA" por "que põe as actions no lockfile (`.github/workflows/actions.lock`)";
  - na linha da #13 do mapa, troque "actions fixadas por SHA" por "lockfile das actions";
  - em "Arquivos em comum", acrescente `.github/workflows/actions.lock` (#13, #21, #23: "Quem muda um `uses:` roda `gh actions-lock` depois do rebase") e `scripts/setup-github.mjs` (#13; a #21 se usar a regra `code_coverage`).
- No `docs/README.md`, cite este plano na linha "Em andamento" de "Fora dos quadrantes".

**Pronto quando:**

- `npm run docs:check` passa.
- O roadmap não fala mais em SHA para a #13.

**Como ficou:** num worktree próprio (`npm run worktree:setup`, slot 3), porque as trilhas B, C e D rodam em paralelo. A branch local `ci/dependabot-codeql-e-lockfile-das-actions` que sobrou do PR #42 (o deste plano, mesmo commit `3b48866`) foi recriada a partir da `main`. O plano já estava na `main` pelo PR #42, então não há commit dele aqui. No roadmap, a coluna "Conflito" das duas linhas novas de "Arquivos em comum" ficou com o texto do plano e, para o `setup-github.mjs`, "A #21 acrescenta a regra no ruleset da #13". `npm run docs:check` passa.

### Passo 2: lockfile das actions e `verify-lockfile.yml`

**Por quê:** uma tag como `@v7` pode ser apontada para outro commit pelo dono da action ou por quem invadir o repositório dela (o caso do `tj-actions/changed-files`, em 2025). O lockfile registra o commit e a identidade do repositório (`owner_id` e `repo_id`) de cada action, inclusive as transitivas, e o runner confere isso no início do job.

**Faça:**

- Instale a extensão: `gh extension install github/gh-actions-lock --pin v0.5.1`.
- Crie `.github/workflows/verify-lockfile.yml` a partir do workflow de referência da extensão:
  - `on: pull_request` e `push` na `main`;
  - `permissions: contents: read`;
  - um job `verify-lockfile`, com esse nome fixo, porque é o check obrigatório do passo 7;
  - `env: GH_TOKEN: ${{ github.token }}`;
  - os steps: checkout com `persist-credentials: false`, `gh extension install github/gh-actions-lock --pin v0.5.1` e `gh actions-lock --verify`;
  - um comentário de cabeçalho como o do `ci.yml`, apontando para `docs/reference/comandos.md#ci` e avisando que renomear o job exige mudar o `setup-github.mjs` e rodar `npm run github:setup`.
- Rode `gh actions-lock --migrate-local-actions` na raiz.
  - Ele gera `.github/workflows/actions.lock` para o `ci.yml` e o `verify-lockfile.yml`.
  - Troca o `uses: ./.github/actions/setup` pela referência ao próprio repositório no commit do workflow (`$/.github/actions/setup`).
  - Estreita `@v7` para a tag completa (`@v7.0.1`).
- Revise o diff inteiro, como pede a doc. Confira:
  - cada `commit`, `owner_id` e `repo_id` corresponde ao repositório oficial da action;
  - os `uses:` do `ci.yml` e do `.github/actions/setup/action.yml` estão na última versão (tabela de referências).
- Rode o `actionlint` local sobre os workflows. Se ele não conhecer a sintaxe `$/`, acrescente uma exceção ao `.github/actionlint.yaml`, com o comentário "tire quando o actionlint conhecer", como a do `command`.

**Pronto quando:**

- `gh actions-lock --verify` passa localmente.
- `gh actions-lock --verify-local` passa. É a conferência offline que o `comandos.md` vai citar.
- Nenhum `uses:` de action externa fica sem entrada no lockfile, e o `uses: ./` não aparece mais nos workflows.
- O `actionlint` passa, com ou sem a exceção nova.
- No CI do PR, o `ci` e o `verify-lockfile` passam. Isso prova que o runner aceita o `$/` e o lockfile.

**Como ficou:** fontes: o README da extensão, o `verify-lockfile.yml` de referência dela (lido pela API; o de referência usa `--pin v0.4.1` e um job `verify`, aqui `v0.5.1` e `verify-lockfile`), o how-to "Lock workflow dependencies" e o "Enforce workflow lockfiles". O `--migrate-local-actions` trocou os 4 `uses: ./.github/actions/setup` do `ci.yml` por `$/` e estreitou o `checkout` para `@v7.0.1`. Como a extensão não edita arquivos de action, o `setup-node@v7` e o `cache@v6` da composite foram estreitados à mão para `@v7.1.0` e `@v6.1.0` (mesmo commit das tags `v7` e `v6`), e o `gh actions-lock` rodou de novo. Conferido pela API: `owner_id` 44036562 (`actions`) e os `repo_id` de `actions/checkout`, `actions/setup-node` e `actions/cache` batem com o lockfile. O actionlint 1.7.12 (a latest) recusa o `$/`: exceção nova no `.github/actionlint.yaml`. A extensão avisa que as imagens dos `services:` do e2e não estão fixadas por digest; é só aviso (o `--verify` passa sem `--fail-on-warning`) e fica fora do plano. O `CODEOWNERS` já cobre o `actions.lock` pelo `*`. `gh actions-lock --verify`, `--verify-local` e `actionlint` passam. No PR #44, o `ci` ([run 45650450299](https://github.com/maiconsouza89/ai-nest-ddd-clean/actions/runs/45650450299)) e o `verify-lockfile` ([run 45650450367](https://github.com/maiconsouza89/ai-nest-ddd-clean/actions/runs/45650450367)) passaram: o runner resolveu o `$/.github/actions/setup` para `maiconsouza89/ai-nest-ddd-clean/.github/actions/setup@<commit do merge>` e aceitou o lockfile.

### Passo 3: `.github/dependabot.yml`

**Por quê:** a regra é sempre a latest estável, e hoje a conferência é manual. O Dependabot abre os PRs e respeita a tabela de exceções pelo `ignore`.

**Faça:**

- Crie `.github/dependabot.yml` (`version: 2`) com três entradas em `updates`, todas com `schedule: { interval: weekly, day: monday, time: "06:00", timezone: America/Sao_Paulo }`:
  - **`npm`**, `directory: /`:
    - `versioning-strategy: increase` e `open-pull-requests-limit: 10`;
    - `commit-message: { prefix: build, include: scope }`;
    - `cooldown: { semver-patch-days: 3, semver-minor-days: 3, semver-major-days: 7 }`;
    - os cinco `groups` da tabela de decisões;
    - o `ignore` da tabela de decisões.
  - **`github-actions`**, `directories: ["/", "/.github/actions/*"]`:
    - `commit-message: { prefix: ci, include: scope }` e `cooldown: { default-days: 3 }`;
    - um grupo `actions` com `patterns: ["*"]`.
  - **`docker-compose`**, `directory: /`:
    - `commit-message: { prefix: build, include: scope }` e `cooldown: { default-days: 3 }`.
- Ponha em cada entrada do `ignore` um comentário com o motivo em poucas palavras e o link para a seção [Exceções](../reference/versoes-e-excecoes.md#exceções).
- Ponha um comentário de cabeçalho apontando para `docs/reference/versoes-e-excecoes.md`.
- Valide o arquivo contra o schema do SchemaStore (`https://json.schemastore.org/dependabot-2.0.json`), uma vez, com o `ajv` 8 que já está na árvore (`node_modules/ajv`, mais `ajv-formats`). Use um script em `/tmp` ou no scratchpad, sem commitar e sem dependência nova.

**Pronto quando:**

- O arquivo valida contra o schema, sem erro.
- Cada pacote da tabela de exceções, menos o `argon2`, tem entrada no `ignore`, e a faixa ignorada é a da decisão.
- Os quatro pacotes do Nest estão no grupo `nestjs`, e o `ignore` deles é só a `12.6.1`.
- Na aba do PR, o GitHub não acusa erro de config no `dependabot.yml`. Se acusar, a mensagem aparece no arquivo e no Insights → Dependency graph → Dependabot depois do merge; volte a este passo.

**Como ficou:** fonte: a referência de opções do `dependabot.yml`. Ela confirma `docker-compose` como ecossistema, `directories` com `*`, o `cooldown` com `semver-*-days` só no npm (actions e compose só com `default-days`), o `update-types` do `ignore` no formato `version-update:semver-*` e o `open-pull-requests-limit` padrão de 5. Nos `groups`, o `update-types` ficou de fora: sem ele, o grupo junta todos os tipos de update, como a decisão pede. O cabeçalho aponta para a seção "Atualização automática" do `versoes-e-excecoes.md`, que o passo 8 cria, e para a tabela de exceções. Validado contra o schema do SchemaStore com o `ajv` 8.20 e o `ajv-formats` da árvore, por um script no scratchpad, sem erro; uma chave errada de propósito no `cooldown` foi recusada, então o schema confere as chaves. **Pendente:** a conferência na aba do PR. Não há API de leitura para o erro de config do `dependabot.yml` antes do merge; fica para o dono olhar na aba "Files changed" do PR #44 ou para o passo 13.

### Passo 4: CodeQL

**Por quê:** nada no CI analisa o código nem os workflows atrás de vulnerabilidade. O CodeQL segue o dado de fora (`req.body`, header, parâmetro) entre arquivos até um ponto perigoso: query, `exec`, path, redirect, regex. Isso numa arquitetura em camadas, onde a entrada e o banco ficam a três arquivos de distância. A linguagem `actions` acha injeção de expressão e permissão larga nos workflows.

**Faça:**

- Crie `.github/workflows/codeql.yml` a partir do starter oficial:
  - `on`: `push` na `main`, `pull_request` para a `main` e `schedule` semanal. Escolha um horário fora da agenda do Dependabot, por exemplo domingo de madrugada em UTC;
  - `permissions: contents: read` no topo, e no job as do starter (`security-events: write`, `packages: read`, `actions: read`, `contents: read`);
  - job `analyze`, com `name: Analyze (${{ matrix.language }})` e matriz `language: [javascript-typescript, actions]`, `build-mode: none` e `fail-fast: false`;
  - steps: checkout com `persist-credentials: false`, `github/codeql-action/init@v4` (com `languages` e `build-mode`) e `github/codeql-action/analyze@v4` com `category: "/language:${{ matrix.language }}"`;
  - sem `queries` (suíte `default`) e sem `paths-ignore`, porque a regra `code_scanning` do ruleset barra o PR enquanto não há análise;
  - um comentário de cabeçalho apontando para `docs/reference/comandos.md#ci`.
- Rode `gh actions-lock` de novo e revise o diff do lockfile.
- Confira na API que o default setup segue desligado (`gh api repos/{owner}/{repo}/code-scanning/default-setup`, `state: not-configured`). Ligado, ele desativaria este workflow.

**Pronto quando:**

- `gh actions-lock --verify` passa.
- No PR, os dois jobs `Analyze (javascript-typescript)` e `Analyze (actions)` passam, e a aba Security → Code scanning mostra as duas categorias.
- Os alertas que a primeira análise do PR achar estão triados no **Como ficou**:
  - um alerta da linguagem `actions` sobre os nossos workflows é corrigido neste PR;
  - um alerta de código `high` ou `critical` é corrigido aqui, se for pequeno, ou vira issue;
  - um falso positivo fica anotado para ser dispensado no passo 12.

**Como ficou:** fonte: o starter oficial (`actions/starter-workflows`, `code-scanning/codeql.yml`, lido pela API). Fora do starter: a matriz só com `language` e o `build-mode: none` fixo no `init`, sem o step de build manual, o `persist-credentials: false` e o `schedule` em `0 3 * * 0` (domingo, 03:00 UTC). O `gh actions-lock` estreitou o `codeql-action` de `@v4` para `@v4.39.5` (`owner_id` 9919, o da organização `github`, e `repo_id` 259445878, conferidos pela API) e avisou que a v4.39.5 saiu há 1 dia, dentro do cooldown de 3 dias (só aviso). O default setup segue `not-configured`. `gh actions-lock --verify` e `actionlint` passam. No PR #44 ([run 45650450883](https://github.com/maiconsouza89/ai-nest-ddd-clean/actions/runs/45650450883)), os dois `Analyze` analisaram (o `actions` rodou as 18 queries e exportou o SARIF) e falharam no upload do resultado: o step `analyze` termina em "Uploading results" sem mensagem de erro no log nem anotação, e `GET code-scanning/analyses` responde "no analysis found". Sem análise, não há alerta para triar. **Pendente:** a causa do upload recusado, a decidir com o dono.

### Passo 5: dependency review

**Por quê:** os PRs, inclusive os do Dependabot, não podem trazer uma dependência com vulnerabilidade `high` ou com licença copyleft que quem copia o template (MIT) herdaria sem perceber. A doc diz que a action só barra o merge quando o check dela é obrigatório.

**Faça:**

- Gere a lista de licenças da árvore atual com o npm, sem dependência nova. Por exemplo, junte o campo `license` de `npm query '*' --json` e tire os repetidos. Confira cada licença:
  - as permissivas (MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0 e as que aparecerem) entram no `allow-licenses`;
  - uma copyleft ou sem SPDX que já esteja na árvore entra como exceção do pacote em `allow-dependencies-licenses` (formato purl, `pkg:npm/<nome>`), com o motivo no **Como ficou**;
  - uma copyleft forte (GPL, AGPL) em dependência de produção é levada ao dono antes de seguir.
- Crie `.github/workflows/dependency-review.yml`:
  - `on: pull_request`;
  - `permissions: contents: read` no topo;
  - um job `dependency-review`, com esse nome fixo e `permissions: contents: read, pull-requests: write`;
  - steps: checkout com `persist-credentials: false` e `actions/dependency-review-action@v5.0.1` com `fail-on-severity: high`, `allow-licenses` (a lista), `allow-dependencies-licenses` (se houver) e `comment-summary-in-pr: on-failure`;
  - um comentário de cabeçalho igual ao do `ci` sobre o nome fixo do job e o `npm run github:setup`.
- Rode `gh actions-lock` de novo e revise o diff do lockfile.
- Teste o bloqueio com um commit temporário na branch do PR:
  - adicione uma dependência com advisory `high` conhecido (escolha a versão no GitHub Advisory Database) e outra com licença fora da lista;
  - confira que o check falha pelos dois motivos e que o comentário aparece;
  - reverta o commit.

**Pronto quando:**

- O check `dependency-review` passa no PR sem o commit temporário e falha com ele, pelos dois motivos (vulnerabilidade e licença).
- O comentário `on-failure` aparece no PR durante o teste.
- `gh actions-lock --verify` passa.

**Como ficou:** fontes: o README da action e o código dela (`src/config.ts`: as listas são separadas por vírgula, então o `>-` do YAML serve; `src/licenses.ts` e `src/purl.ts`: a exceção casa pelo tipo e nome do purl, sem versão e sem curinga; a expressão SPDX passa pelo `satisfies`, então `(MIT OR CC0-1.0)` basta ter uma das duas na lista). As licenças vieram do `npm query '*' --json` e do campo `license` do `package-lock.json` (que tem também os binários de outras plataformas). No `allow-licenses`: MIT, MIT-0, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0, CC-BY-3.0 (`spdx-exceptions`, dev), PSF-2.0 (`argparse`) e Unlicense (`tweetnacl`, dev). No `allow-dependencies-licenses`: o `lightningcss` e os 11 binários por plataforma, MPL-2.0 (copyleft fraca, por arquivo), só em desenvolvimento, pelo `vite`. Nenhuma GPL ou AGPL na árvore. Seis pacotes sem `license` no lockfile (`busboy`, `streamsearch`, `ssh2`, `buildcheck`, `cpu-features`, `format`) são MIT no `package.json` deles; a action lê a licença do ClearlyDefined, e uma não detectada não falha. O lockfile ganhou a `dependency-review-action@v5.0.1` (`owner_id` 44036562, `repo_id` 476372928, conferidos pela API). `gh actions-lock --verify` e `actionlint` passam. No PR #44 ([run 45650450413](https://github.com/maiconsouza89/ai-nest-ddd-clean/actions/runs/45650450413)), o check falhou com `Forbidden` na API `dependency-graph/compare`: o dependency graph do repositório está desligado (`GET dependency-graph/sbom` e `GET vulnerability-alerts` respondem 404). A doc do dependency review exige o dependency graph, e o plano só liga os alerts, que ligam o graph, no passo 10, depois do merge. **Pendente:** ligar o dependency graph antes do merge (decisão do dono) e o teste do bloqueio.

### Passo 6: `audit:signatures`

**Por quê:** o dependency review e os alerts cobrem advisories, mas nada confere que cada pacote instalado veio assinado do registry do npm. Isso pega lockfile adulterado ou pacote de outra origem. Rodado aqui em 2026-11-25: 1015 pacotes com assinatura verificada e 235 com attestation, em uns 18 s.

**Faça:**

- No `package.json`, acrescente o script `"audit:signatures": "npm audit signatures"`.
- No job `check` do `ci.yml`, acrescente um step `- run: npm run audit:signatures` depois do `npm run ci:static`, num step próprio, para o log mostrar qual dos dois falhou. O `ci:static` não muda.

**Pronto quando:**

- `npm run audit:signatures` passa localmente.
- No PR, o job `check` mostra o step separado, verde.
- `npm run ci` local não roda o `audit:signatures`.

**Como ficou:** como no "Faça". `npm run audit:signatures` passa localmente: 1015 pacotes com assinatura verificada e 235 com attestation, em uns 27 s. O `ci` e o `ci:static` do `package.json` não mudaram, então o `npm run ci` local não roda o `audit:signatures`. No PR #44, o job `check` mostra o step `Run npm run audit:signatures` separado, depois do `ci:static`, verde ([job 139333198588](https://github.com/maiconsouza89/ai-nest-ddd-clean/actions/runs/45650450299/job/139333198588)).

### Passo 7: `setup-github.mjs`

**Por quê:** a configuração de segurança do repositório precisa ser reproduzível para quem copia o template. O script já cria o ruleset, o merge por squash e o relato privado de vulnerabilidade.

**Faça:**

- **`required_status_checks`:** passe a exigir `ci`, `dependency-review` e `verify-lockfile`, todos com o `integration_id` do GitHub Actions.
- **Regra `code_scanning`:** acrescente `{ type: 'code_scanning', parameters: { code_scanning_tools: [{ tool: 'CodeQL', alerts_threshold: 'errors', security_alerts_threshold: 'high_or_higher' }] } }`, só quando o code scanning estiver disponível:
  - num repo público, sempre;
  - num privado ou interno, só se o `security_and_analysis` de `GET repos/{repo}` mostrar o GitHub Code Security (ou o Advanced Security) ligado. Confira o nome do campo na doc antes de usar.
  - Sem o code scanning, o script avisa e segue, como faz hoje com o relato privado.
- **Dependabot alerts:** `PUT repos/{repo}/vulnerability-alerts`.
- **Security updates:** `PUT repos/{repo}/automated-security-fixes`. Depende dos alerts, então vem depois.
- **Política de SHA:** `PUT repos/{repo}/actions/permissions` com `sha_pinning_required: true`. Antes, leia o estado com `GET` e reenvie `enabled` e `allowed_actions` como estão: o `enabled` é obrigatório no `PUT`.
- **Avisos de saída:**
  - a "Require lockfile" é ligada à mão (Settings → Actions → Policies), com o link para o `comandos.md`;
  - o script não liga o secret scanning.
- **Comentário de cabeçalho:** atualize-o com o que o script passa a fazer.
- **Não rode o script contra o repositório real neste passo.** Ele roda no passo 10, depois do merge.

**Pronto quando:**

- `npm run lint` passa.
- Os corpos das chamadas conferem com a doc da REST API (tabela de referências), campo por campo, anotados no **Como ficou**.
- O script continua idempotente: rodado duas vezes, atualiza o mesmo ruleset e mantém o bypass e as regras de outros tipos.

**Como ficou:** os corpos conferidos com a doc da REST API, campo por campo:

- `required_status_checks`: `strict_required_status_checks_policy` (obrigatório) e `required_status_checks[]` com `context` e `integration_id` (15368, o GitHub Actions), para `ci`, `dependency-review` e `verify-lockfile`.
- `code_scanning`: `code_scanning_tools[]` com `tool` (`CodeQL`), `alerts_threshold` (`errors`, do enum `none`, `errors`, `errors_and_warnings`, `all`) e `security_alerts_threshold` (`high_or_higher`, do enum `none`, `critical`, `high_or_higher`, `medium_or_higher`, `all`), os três obrigatórios.
- Disponibilidade do code scanning: repo público sempre; privado ou interno pelo `security_and_analysis.code_security.status` ou `security_and_analysis.advanced_security.status` igual a `enabled` no `GET repos/{repo}` (o bloco só aparece para admin, que o script já exige). Sem ele, avisa e segue sem a regra.
- `PUT repos/{repo}/vulnerability-alerts` e `PUT repos/{repo}/automated-security-fixes`: sem corpo, 204, admin. Nessa ordem.
- `PUT repos/{repo}/actions/permissions`: `enabled` (obrigatório), `allowed_actions` (opcional, reenviado como veio do `GET`) e `sha_pinning_required: true`; 204.
- Avisos de saída: a "Require lockfile" à mão, com o link para o `comandos.md#ci`, e o secret scanning desligado.

Idempotência conferida com um `gh` falso no scratchpad (sem tocar no GitHub): a primeira execução cria o ruleset; depois o falso acrescenta um bypass e uma regra `pull_request`, como a interface faria; a segunda execução faz `PUT` no mesmo id, mantém o bypass e a `pull_request`, e as regras do script (`deletion`, `non_fast_forward`, `required_status_checks` com os três checks, `code_scanning`) não se repetem. Num privado sem Code Security, a regra do CodeQL fica de fora com o aviso; com ele, entra. O script não rodou contra o repositório real. `npm run lint` passa.

### Passo 8: documentação

**Por quê:** a issue pede que o `versoes-e-excecoes.md` e o `comandos.md` descrevam o fluxo. O porquê vai na ADR, e os agentes precisam da rota e da armadilha no `AGENTS.md`.

**Faça:**

- **`docs/adr/0012-cadeia-de-suprimentos-do-ci.md`** (`npm run plop doc` se houver tipo `adr`, senão no formato das ADRs anteriores). Porquês e alternativas descartadas:
  - Dependabot × Renovate;
  - CodeQL advanced × default setup × Semgrep e Sonar;
  - dependency review em workflow obrigatório × job do `ci.yml`;
  - lockfile × SHA à mão, citando a mudança do guia oficial;
  - `sha_pinning_required` + check × só a "Require lockfile", sem regra na API;
  - o `ignore` por versão × por pacote;
  - `npm audit signatures` × `npm audit --audit-level`;
  - o npm do Node no CI × `npm@latest`, que baixaria código sem fixar versão.
- **`docs/README.md`:** a ADR 0012 no índice.
- **`docs/reference/versoes-e-excecoes.md`**, seção nova "Atualização automática":
  - o Dependabot, os três ecossistemas, a agenda, o cooldown e os grupos;
  - a regra "uma linha nova, mudada ou removida na tabela de exceções muda o `ignore` do `.github/dependabot.yml` no mesmo PR";
  - as imagens: o PR do Dependabot muda só o `docker-compose.yml`, e quem o fecha completa as outras ocorrências na mesma branch:
    - `postgres:19`: `.github/workflows/ci.yml` (`services:`) e `test/global-setup/int.ts`;
    - `redis:8`: `.github/workflows/ci.yml` e `test/helpers/redis.ts`;
    - `axllent/mailpit:v1`: `.github/workflows/ci.yml` e `src/modules/notifications/infra/adapters/smtp-email-sender.int-spec.ts`;
    - numa major do Postgres, o volume precisa ser recriado (link para o how-to de resetar o ambiente);
  - o Node (`.nvmrc`, o `ARG NODE_VERSION` do Dockerfile e o `engines`) é conferido à mão;
  - o `npm outdated` continua valendo como conferência.
- **`docs/reference/comandos.md`, seção CI:**
  - a tabela de workflows: `ci.yml`, `codeql.yml`, `dependency-review.yml` e `verify-lockfile.yml`, com gatilhos e o que cada um faz;
  - o step `audit:signatures` no job `check` e a linha do `ci:static` ("é o job `check`" passa a "o job `check` roda o `ci:static` e o `audit:signatures`");
  - os checks obrigatórios e a regra `code_scanning`;
  - como dispensar um falso positivo do CodeQL (aba Security, com o motivo);
  - o lockfile: instalar a extensão (`gh extension install github/gh-actions-lock --pin v0.5.1`), rodar `gh actions-lock` depois de mudar um `uses:` e conferir com `gh actions-lock --verify-local`;
  - o `github:setup`: o que ele liga agora, e a "Require lockfile" à mão.
  - Na tabela de "Verificação", o `audit:signatures`.
- **`.github/CONTRIBUTING.md`:** os PRs do Dependabot ficam com o título que ele gera, em inglês. O `build(deps)` ou `ci(deps)` segue o Conventional Commits, e uma major que quebre quem usa o template ganha o `!` à mão no squash.
- **`docs/reference/evolucoes-com-gatilho.md`:** a linha do zizmor, na seção CI.
- **`AGENTS.md`:**
  - a rota "Mexer num workflow ou action do CI, no Dependabot, no CodeQL ou no dependency review → `docs/reference/comandos.md#ci` e `docs/adr/0012-cadeia-de-suprimentos-do-ci.md`", logo abaixo de "Adicionar ou atualizar dependência";
  - em "Versões", a frase "Uma exceção nova ou removida muda também o `ignore` do `.github/dependabot.yml`";
  - em "Armadilhas", a linha "**Actions:** depois de adicionar ou mudar um `uses:`, rode `gh actions-lock` (extensão `github/gh-actions-lock`) e commite o `actions.lock`. Nunca edite o lockfile à mão".
- **Comentário do `ci.yml`** sobre o check obrigatório: cite os três checks e a regra do CodeQL.

**Pronto quando:**

- `npm run docs:check` passa.
- Cada decisão da tabela do plano aparece numa página de `docs/` ou na ADR. O plano vai ser apagado.
- O "Pronto quando" da issue que dá para conferir antes do merge está atendido: `versoes-e-excecoes.md` e `comandos.md` (seção CI) descrevem o fluxo.

**Como ficou:** o `plop doc` não tem tipo `adr`, então a ADR 0012 seguiu o formato da 0011 (`status: accepted`, "Considered Options" e "Consequences"), com as oito alternativas do "Faça". No `comandos.md`, além do pedido, uma linha "Dependabot" na seção CI aponta para a seção nova do `versoes-e-excecoes.md`, e o `npm run ci` da tabela de verificação diz que não roda o `audit:signatures`. A linha do zizmor entrou na seção CI do `evolucoes-com-gatilho.md`, com o gatilho da tabela "Fora do plano". Cada decisão da tabela do plano está na ADR, no `versoes-e-excecoes.md` (ecossistemas, agenda, cooldown, grupos, limite de PRs, `increase`, `ignore`, imagens, título dos PRs), no `comandos.md` (workflows, CodeQL, regra `code_scanning`, dependency review, lockfile, `sha_pinning_required`, "Require lockfile", `audit:signatures`, `github:setup`), no `CONTRIBUTING.md` (título em inglês) ou no `AGENTS.md` (rota, frase de "Versões" e armadilha); "Entrega" e "Fechamento da issue" são do processo e ficam no registro da #13. `npm run docs:check` passa, e a rota nova com `#ci` passa na regra de caminhos do `AGENTS.md`.

### Passo 9: verificação, entrega e PR

**Por quê:** a definição de pronto do `AGENTS.md`, e o registro do plano, que sai deste arquivo antes do squash.

**Faça:**

- Rode `npm run ci`. O PR não toca banco, Redis, filas nem HTTP, então o `test:int` e o `test:e2e` locais não são exigidos. O CI roda a suíte inteira, porque `.github/workflows/**` e `package.json` estão no `forceRerunTriggers`.
- Rode `/simplify` e depois `/code-review` sobre as mudanças, e aplique o que for real.
- Apague este arquivo e tire a menção dele do `docs/README.md`. A rota "Continuar um plano em andamento" fica, por causa do roadmap.
- Com o ok do dono:
  - poste o comentário de registro na #13, com as decisões, o **Como ficou** de cada passo, a troca de SHA por lockfile e o checklist da fase 2;
  - abra o PR com o título `ci: Dependabot, CodeQL, dependency review e lockfile das actions (#13)`, seguindo o template e o `.github/CONTRIBUTING.md`. A descrição explica a troca de SHA por lockfile e lista o que só vale depois do merge.

**Pronto quando:**

- `npm run ci` passa.
- No PR, passam o `ci`, o `dependency-review`, o `verify-lockfile` e os dois `Analyze`.
- O `/simplify` e o `/code-review` rodaram, e o que ficou de fora está justificado na descrição do PR.
- O comentário de registro está na #13, com o link no PR.

**Como ficou:** `npm run ci` passa (47 arquivos e 302 testes unitários), com `actionlint` e `gh actions-lock --verify` também verdes. O `test:int` e o `test:e2e` não rodaram: o PR não toca banco, Redis, filas nem HTTP.

- `/simplify` (reuso, simplificação, eficiência e altitude). Aplicado: a exceção do `$/` no `.github/actionlint.yaml` passou a valer para qualquer `$/` em `.github/workflows/*.yml`; a seção "Atualização automática" deixou de repetir as faixas da tabela de exceções; a checagem do code scanning do `setup-github.mjs` virou uma função. Fora, por contrariar o plano: tirar o checkout do `dependency-review.yml` (a action lê o diff pela API), rodar o `audit:signatures` só quando o `package-lock.json` muda, juntar o `gh repo view` e o `GET repos/{repo}` numa chamada, e um helper para o padrão `run` + `fail` do script, que já existia antes (refatoração de oportunidade).
- `/code-review` (medium). Aplicado: o `setup-github.mjs` passa a tratar o `code_scanning` como regra dele mesmo quando a deixa de fora, então um repo privado que perde o Code Security não fica com a regra velha travando os PRs (conferido com o `gh` falso); o passo 4 do `README.md` descreve o que o `github:setup` faz agora. Descartado com fonte: o `sha_pinning_required` não quebra os workflows com tag, porque "A lockfile satisfies the SHA-pinning requirement for workflows that are onboarded to a lockfile" (Control workflow execution); o comentário do dependency review sem permissão só dá aviso (`src/comment-pr.ts`); o PR do Dependabot regenera o `actions.lock` dos workflows no lockfile (how-to "Lock workflow dependencies"); a REST API de políticas continua só com `restrict_actions_actors` e `restrict_action_events`. Ficam para o dono: (a) o `ignore` só da 12.6.1 com o grupo `nestjs` pode travar o PR do grupo se outro `@nestjs/*` pedir `@nestjs/common ^12.6.1` antes da correção sair; (b) o ecossistema `docker-compose` vai ver a imagem `ai-nest-ddd-clean:local` do profile `prod` e pode registrar erro de lookup no log, o que um `ignore` dela resolveria; (c) o Dependabot pode não entender o `uses: $/…` (o passo 13 confere no log); (d) a extensão é instalada pela tag `v0.5.1`, como no workflow de referência, e não por commit.
- **Pendente (depende de push, PR e ok do dono):** apagar este arquivo e a menção no `docs/README.md`, o comentário de registro na #13, abrir o PR e conferir os checks dele.

---

## Fase 2: depois do merge

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> Este arquivo já terá sido apagado no passo 9. O checklist desta fase vive no comentário de registro da #13, e os passos ficam aqui só até lá.
>
> - [ ] Passo 10: `npm run github:setup` no repositório
> - [ ] Passo 11: "Require lockfile" e o CI da `main`
> - [ ] Passo 12: CodeQL na `main` e triagem
> - [ ] Passo 13: primeira rodada do Dependabot
> - [ ] Passo 14: encerramento

### Passo 10: `npm run github:setup` no repositório

**Por quê:** os checks obrigatórios novos, a regra do CodeQL, a política de SHA e os alerts só entram depois do merge. Antes dele, os PRs abertos de outras trilhas ficariam pendentes, à espera de checks que só existem na branch da #13.

**Faça:**

- Com o ok do dono, rode `npm run github:setup` no checkout principal, já com a `main` atualizada.
- Confira pela API:
  - `gh api repos/{owner}/{repo}/rulesets/<id>`: os três checks e a regra `code_scanning`;
  - `gh api repos/{owner}/{repo}/actions/permissions`: `sha_pinning_required: true`;
  - `gh api -i repos/{owner}/{repo}/vulnerability-alerts`: 204;
  - `gh api repos/{owner}/{repo}/automated-security-fixes`: `enabled: true`.

**Pronto quando:** as quatro conferências batem.

**Como ficou:** —

### Passo 11: "Require lockfile" e o CI da `main`

**Por quê:** a política não tem API. E a doc não diz se o `sha_pinning_required` trata a referência `$/` à própria composite como action "não fixada". Isso precisa ser visto num run real.

**Faça:**

- Rode de novo o último workflow `CI` da `main` (`gh run rerun <id>`, com o ok do dono) e o `verify-lockfile`. Confira que passam com o `sha_pinning_required` ligado.
- O dono liga a política "Require lockfile" em Settings → Actions → Policies, mirando todos os workflows, com o enforcement `active`. O `evaluate` é só do Enterprise Cloud.
- Rode o `CI` da `main` de novo.
- Se um run quebrar por política:
  - desligue a política que quebrou (com o ok do dono);
  - registre o erro na #13;
  - corrija num PR de seguimento.

**Pronto quando:**

- Com as duas políticas ligadas, o `CI`, o `verify-lockfile` e o `CodeQL` passam na `main`.
- `gh api repos/{owner}/{repo}/actions/policies` lista a política.

**Como ficou:** —

### Passo 12: CodeQL na `main` e triagem

**Por quê:** a primeira análise da `main` mostra os alertas que o código já tem. A regra do ruleset só barra alertas em linhas do diff de um PR, então os antigos precisam de triagem explícita.

**Faça:**

- Liste os alertas abertos: `gh api repos/{owner}/{repo}/code-scanning/alerts --jq '.[] | {number, rule: .rule.id, severity: .rule.security_severity_level, path: .most_recent_instance.location.path}'`.
- Para cada um, decida e registre:
  - um falso positivo ou "won't fix" é dispensado com o motivo, com o ok do dono;
  - um real vira PR de correção ou issue.
- Confira que o `schedule` semanal está registrado (aba Actions → CodeQL).

**Pronto quando:** nenhum alerta fica aberto sem decisão, e as decisões estão no comentário da #13.

**Como ficou:** —

### Passo 13: primeira rodada do Dependabot

**Por quê:** o "Pronto quando" da issue diz "O Dependabot abre PRs que passam pelo check `ci`". Isso só se prova com o config na branch padrão.

**Faça:**

- Logo depois do merge, abra Insights → Dependency graph → Dependabot e confira que os três ecossistemas foram checados sem erro de config. Para cada um, "Check for updates" mostra o log da última execução.
- Na primeira segunda-feira depois do merge, confira os PRs abertos pelo Dependabot:
  - cada um passa no `ci`, no `dependency-review`, no `verify-lockfile` e no CodeQL;
  - os títulos seguem `build(deps)`, `build(deps-dev)` e `ci(deps)`;
  - um PR de grupo junta o que devia;
  - nenhum PR propõe uma versão que o `ignore` barra (Nest 12.6.1, TypeScript 6.1 ou acima, majors de `keyv`, `@keyv/redis` e `ioredis`);
  - um PR de action atualiza também o `actions.lock`.
- **Risco conhecido:** a doc diz que o Dependabot regenera o lockfile de workflows já no lockfile, mas não fala de um bump no `.github/actions/setup/action.yml`. Se o PR de bump da composite falhar no `verify-lockfile`, rode `gh actions-lock` na branch dele e registre isso no `comandos.md`.
- Se nenhum PR for aberto porque tudo está na latest, guarde o log do Dependabot como evidência.

**Pronto quando:** os PRs da primeira rodada passam nos checks, ou o log mostra os três ecossistemas checados sem nada a atualizar. O resultado vai no comentário da #13.

**Como ficou:** —

### Passo 14: encerramento

**Por quê:** fechar a issue com o registro e deixar o roadmap em dia.

**Faça:**

- Com o ok do dono, abra a issue de secret scanning e push protection, com os rótulos `enhancement`, `área: segurança` e a prioridade que o dono escolher.
- No `docs/plan/roadmap-das-issues-abertas.md`, marque a #13 com ✅ e o número do PR, no próximo PR que mexer nele ou num PR só do roadmap.
- Atualize o comentário de registro da #13 com o resultado dos passos 10 a 13 e feche a issue.

**Pronto quando:**

- A #13 está fechada, com o registro completo.
- A issue de secret scanning existe.
- O roadmap mostra a #13 ✅.

**Como ficou:** —
