---
type: how-to
---

# Como atualizar o contrato OpenAPI

Use este guia depois de mudar um controller, um DTO ou um decorator do Swagger, para o `openapi.json` da raiz acompanhar o código.

## Pré-requisitos

- A mudança do controller, do DTO ou do decorator salva no disco. O `openapi:generate` não precisa de Postgres nem de Redis ([Operação → Swagger](../reference/operacao.md#swagger)).
- Nenhum `start:dev` no ar neste checkout, ou espere ele recompilar depois: o `nest build` do gerador apaga e refaz o `dist/`.

## Passos

1. Gere o arquivo a partir do código:

   ```bash
   npm run openapi:generate
   ```

   Nunca edite o `openapi.json` à mão: o `openapi:check` compara o arquivo com o que o gerador produz.

   Se o gerador falhar com a lista de rotas sem resposta de sucesso, documente o corpo de cada uma com a classe de resposta e o decorator ([Camadas → Infra](../reference/camadas.md#infra)) e rode de novo.

2. Commite o `openapi.json` no mesmo commit, ou no mesmo PR, da mudança no código.

3. Se a mudança quebra o contrato de propósito e o job `openapi` do PR acusa a quebra:

   1. Acrescente ao `.github/oasdiff/err-ignore.txt` uma linha por quebra aceita, com o método e o caminho mais a mensagem do `oasdiff`, inteiros, e o número do PR:

      ```text
      POST /v1/auth/login removed the request property `password` (#123)
      ```

      Uma quebra acusada em várias rotas pede uma linha por rota e status. Apague as linhas de PRs já mergeados. O formato está em [Comandos → CI](../reference/comandos.md#ci).

   2. Ponha o `!` no título do PR e o parágrafo `BREAKING CHANGE: …` na descrição, conforme [Como contribuir](../../.github/CONTRIBUTING.md#commits-e-título-do-pr).

   Antes de aceitar uma quebra, confira se uma `/v2` aditiva resolve ([Convenções](../reference/convencoes.md#versionamento-da-api-http)).

## Conflito no `openapi.json`

Num rebase ou merge com conflito no `openapi.json`, não resolva o arquivo à mão:

1. Resolva o conflito dos outros arquivos.
2. Regere o arquivo a partir do código já resolvido:

   ```bash
   npm run openapi:generate
   ```

3. Ponha o arquivo no stage e siga o rebase:

   ```bash
   git add openapi.json
   git rebase --continue
   ```

## Como verificar

- `npm run openapi:check` passa. Com o arquivo desatualizado, ele falha com `openapi.json desatualizado: rode npm run openapi:generate e commite o arquivo`.
- No PR, o job `openapi` passa.
- Para ver as quebras antes do PR, com o binário do `oasdiff` baixado à mão do release:

  ```bash
  oasdiff breaking origin/main:openapi.json openapi.json --config .github/oasdiff/config.yaml
  ```

  A saída 1 indica uma quebra.

## Veja também

- [Comandos → CI](../reference/comandos.md#ci): o job `openapi`, a severidade de cada mudança e o formato do `err-ignore.txt`.
- [Comandos → Verificação](../reference/comandos.md#verificação): o `openapi:generate` e o `openapi:check`.
- [Operação → Swagger](../reference/operacao.md#swagger): como o documento é montado.
