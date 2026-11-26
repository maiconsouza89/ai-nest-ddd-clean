---
type: how-to
---

# Como mudar uma action do CI

Use este guia para adicionar, trocar ou atualizar um `uses:` num workflow de `.github/workflows/` ou na composite `.github/actions/setup`, com o `actions.lock` em dia.

## Pré-requisitos

- O `gh` autenticado.
- A extensão `gh-actions-lock` instalada, uma vez por máquina:

  ```bash
  gh extension install github/gh-actions-lock --pin v0.5.1
  ```

## Passos

1. Mude o `uses:` no workflow ou na composite. Numa action do próprio repositório, use `$/` e não `./`, como em `uses: $/.github/actions/setup`: o `./` não entra no lockfile.

2. Atualize o lockfile, na raiz do repositório:

   ```bash
   gh actions-lock
   ```

3. Revise o diff inteiro do `.github/workflows/actions.lock`:

   - uma troca de `commit` é uma troca de código da action;
   - uma troca de `owner_id` ou `repo_id` indica outro repositório atrás do nome: investigue antes de seguir.

4. Commite o `actions.lock` junto com o workflow. Nunca edite o lockfile à mão.

O PR do Dependabot que atualiza uma action já traz o `actions.lock` ([Versões e exceções → Atualização automática](../reference/versoes-e-excecoes.md#atualização-automática)).

## Ligar o "Require lockfile" num repositório novo

A política que bloqueia um workflow sem lockfile não tem API, e o `npm run github:setup` não a liga. Uma vez por repositório, depois do `npm run github:setup`:

1. Abra Settings → Actions → Policies do repositório.
2. Ligue o "Require lockfile", mirando todos os workflows, com o enforcement `Active`.

## Como verificar

- Cada `uses:` tem entrada no lockfile, sem rede:

  ```bash
  gh actions-lock --verify-local
  ```

- A conferência completa, a mesma do CI, que confere também cada commit travado contra o upstream:

  ```bash
  gh actions-lock --verify
  ```

- No PR, o check `verify-lockfile` passa.

## Veja também

- [Comandos → CI](../reference/comandos.md#ci): o lockfile das actions, o check `verify-lockfile` e o `github:setup`.
- [ADR 0012](../adr/0012-cadeia-de-suprimentos-do-ci.md): por que o lockfile e não o SHA à mão no `uses:`.
