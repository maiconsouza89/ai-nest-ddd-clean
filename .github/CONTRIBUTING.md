# Como contribuir

O setup do ambiente está no [README](../README.md#quickstart). Uma vulnerabilidade não vira issue: siga a [política de segurança](SECURITY.md).

## Fluxo

1. Abra uma issue, ou comente numa que já existe, antes de uma mudança grande. Os formulários de bug e de melhoria pedem o contexto que a revisão precisa.
2. Crie a branch a partir da `main`, com o tipo do commit no nome: `feat/rate-limit-por-conta`, `fix/refresh-token-expirado`.
3. Abra o PR para a `main`. O template traz o checklist da definição de pronto.
4. O merge é só por squash: o PR vira um commit na `main`, com o título e a descrição do PR.

## Commits e título do PR

O título do PR e cada commit da branch seguem o [Conventional Commits 1.0.0](https://www.conventionalcommits.org/pt-br/v1.0.0/): o título vira o commit da `main` no squash. O hook `commit-msg` confere cada commit local, e o job `pr-title` do CI confere o título do PR ([Comandos → Hooks do git](../docs/reference/comandos.md#hooks-do-git)). As regras ficam no `commitlint.config.mjs`: uma mudança nos tipos abaixo muda os dois arquivos.

```text
<tipo>(<escopo>): <descrição>
```

- **Tipo:** `feat` (comportamento novo), `fix` (correção), `docs`, `refactor`, `test`, `perf`, `build` (dependências, `Dockerfile`), `ci` (workflows) ou `chore` (o resto).
- **Escopo:** o módulo (`identity`, `orders`) ou a área (`http`, `deploy`, `ci`), opcional.
- **Descrição:** em português, no imperativo ou no presente, sem ponto final. Pode começar com maiúscula quando a primeira palavra é um nome próprio (`ci: Dependabot …`).
- **Tamanho:** o cabeçalho tem até 100 caracteres, sem contar o `(#<PR>)` que o squash acrescenta.
- **Quebra:** `!` depois do tipo ou do escopo (`feat(identity)!: …`) e um parágrafo `BREAKING CHANGE: …` na descrição do PR, dizendo o que quem usa precisa mudar.

Os PRs do Dependabot ficam com o título que ele gera, em inglês: `build(deps): bump …`, `build(deps-dev): bump …` ou `ci(deps): bump …`. O tipo e o escopo seguem o Conventional Commits. Uma major que quebre quem usa o template (ver [Versão](#versão)) ganha o `!` à mão no título do squash.

Quando o PR resolve uma issue, o título termina com o número dela, e o GitHub acrescenta o do PR no squash: `feat(deploy): imagem Docker, migrations a partir do dist/ e how-to de deploy (#10) (#24)`.

## Versão

O template segue o [SemVer 2.0.0](https://semver.org/lang/pt-BR/). O tipo dos commits desde a última release decide a versão seguinte:

| Commits desde a última release | Sobe |
| --- | --- |
| Algum com `!` ou `BREAKING CHANGE` | Major |
| Algum `feat` | Minor |
| Só `fix`, `perf` e os outros tipos | Patch |

Num template, quebra é o que obriga um projeto que copiou o código a mudar o dele para acompanhar: o contrato HTTP, uma variável de ambiente, o `contracts/` ou um evento de integração de um módulo, o schema sem migration compatível, um comando do `package.json` ou a versão mínima do Node.

Uma release é manual: o `version` do `package.json`, a tag `vX.Y.Z` na `main` e uma release no GitHub com as notas geradas a partir dos PRs.

## Antes de abrir o PR

- `npm run ci` passa. Rode também `npm run test:int` e `npm run test:e2e` quando a mudança tocar banco, Redis, filas ou HTTP. Os comandos estão em [Comandos → Verificação](../docs/reference/comandos.md#verificação).
- Uma mudança de comportamento atualiza a página do quadrante afetado em `docs/`, ou o PR diz por que não precisa. Como escolher e escrever a página: [Documentação](../docs/README.md).
- Uma dependência nova ou atualizada segue [Versões e exceções](../docs/reference/versoes-e-excecoes.md).

## Agentes de código

As instruções para agentes ficam no [AGENTS.md](../AGENTS.md), com as armadilhas do projeto e a rota para cada página de `docs/`.
