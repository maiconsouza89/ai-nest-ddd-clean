---
status: accepted
---

# Hooks do git com lefthook e commitlint no título do PR

Os commits seguiam o Conventional Commits por convenção, sem checagem, e o lint, a formatação e os tipos só eram conferidos no CI ou quando alguém lembrava de rodar `npm run ci` ([issue #22](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/22)). O merge é só por squash, com o título do PR como mensagem: o commit da `main` nunca passa por um hook local, e um hook se pula com `--no-verify`.

O projeto usa o **lefthook** para os três hooks, num `lefthook.yml`, e o **commitlint** com o `@commitlint/config-conventional` no hook e no CI. O CI continua a fonte de verdade, porque os hooks se pulam.

- **`pre-commit`:** nos arquivos em stage, em sequência, o Prettier com `--write` e a correção no stage, o ESLint sem `--fix` e o `markdownlint-cli2` nos `.md`. O Markdown fica com o markdownlint porque o Prettier não o formata ([ADR 0006](0006-documentacao-diataxis-e-roteamento-para-agentes.md)).
- **`commit-msg`:** o commitlint, com as regras do `commitlint.config.mjs`: os nove tipos do CONTRIBUTING, sem a `subject-case` (um nome próprio abre o assunto com maiúscula) e sem limite de linha no corpo (um parágrafo por linha).
- **`pre-push`:** o `typecheck` e o `arch`, que olham o projeto inteiro, em paralelo.
- **Job `pr-title`** (`.github/workflows/pr-title.yml`): o mesmo commitlint sobre o título do PR, check obrigatório no ruleset do `scripts/setup-github.mjs`.
- **Instalação:** o `prepare` do npm roda o `scripts/install-git-hooks.mjs`, que roda o `lefthook install` só no checkout principal, fora do CI. O `postinstall` do lefthook fica negado no `allowScripts` do `package.json`.

O lefthook grava os hooks no diretório comum do git (`git rev-parse --git-path hooks`), e eles valem em todo worktree desde a criação, com a config da branch do worktree ([ADR 0011](0011-worktrees-compartilham-o-stack-do-checkout-principal.md)).

Como usar: [Comandos → Hooks do git](../reference/comandos.md#hooks-do-git) e [Como contribuir](../../.github/CONTRIBUTING.md#commits-e-título-do-pr).

## Considered Options

- **husky com lint-staged:** dois pacotes no lugar de um. O husky 9 grava o `core.hooksPath` como `.husky/_`, caminho relativo que só existe no checkout que rodou o `prepare`: num worktree antes do `npm ci`, o commit passa sem hook e sem aviso.
- **Só o CI:** o erro de lint ou de mensagem aparece minutos depois do push, e não no commit. A issue pede que ele seja barrado localmente.
- **O `tsc` e os testes no pre-commit:** o `tsc` confere o projeto inteiro, não os arquivos em stage, e os unitários e o `ci:static` somam mais de um minuto. O `tsc` e o `arch` ficam no pre-push; os testes, no CI.
- **O `postinstall` do lefthook aprovado no `allowScripts`:** a aprovação fixa a versão do pacote (`lefthook@2.2.3`), e o PR do Dependabot que o sobe a deixaria vencida, sem aviso. Rodaria também no `npm ci` de um worktree e no build da imagem.
- **release-please para o CHANGELOG e as tags:** o PR de release aberto com o `GITHUB_TOKEN` não dispara os outros workflows, então o check obrigatório `ci` nunca rodaria nele sem um PAT ou um GitHub App com segredo no repositório. Pede também `contents: write`, `pull-requests: write` e a opção que deixa o GitHub Actions criar PRs, o que alarga a superfície da [ADR 0012](0012-cadeia-de-suprimentos-do-ci.md). Num template, o CHANGELOG e o workflow viriam junto para quem copia. O gatilho para rever está em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#ci).
- **`scope-enum` no commitlint:** o escopo é o módulo ou a área, uma lista aberta, e uma lista fechada pediria uma linha na config a cada área nova.

## Consequences

- O `Dockerfile` roda o `npm ci` com `--ignore-scripts` nos dois estágios: o script do `prepare` não está no contexto do build. Os scripts de instalação das dependências também deixam de rodar na imagem; o `argon2` carrega o binário pronto do pacote.
- O `prepare` nunca quebra o `npm install`: sem `.git`, no CI, num worktree ou com uma falha do `lefthook install`, ele só avisa.
- Os hooks são comuns ao checkout principal e a todos os worktrees, e apontam para o binário do lefthook de quem os instalou. Numa branch sem `lefthook.yml`, o hook avisa que não achou a config e deixa o commit passar.
- Antes do `worktree:setup`, sem `node_modules`, o commit num worktree falha no hook.
- Os commits da branch seguem o Conventional Commits, como o título do PR.
- Um agente de código vê o arquivo mudar no disco depois do commit, pela correção do Prettier, e não pode pular os hooks sem o ok do dono (`AGENTS.md`).
- O `pr-title` só vira obrigatório depois do `npm run github:setup`.
