---
type: how-to
---

# Como atualizar uma dependência

Use este guia para atualizar ou adicionar um pacote do npm, ou para fechar um PR do Dependabot.

## Pré-requisitos

- A [regra de versões](../reference/versoes-e-excecoes.md#regra) e a [tabela de exceções](../reference/versoes-e-excecoes.md#exceções), com o gatilho de cada linha.
- Acesso ao Context7 (MCP `context7`), ou à documentação oficial do pacote.

## Passos

1. Procure o pacote na [tabela de exceções](../reference/versoes-e-excecoes.md#exceções). Se ele está lá, confira o gatilho da coluna "Atualize quando": sem o gatilho cumprido, não atualize.

2. Consulte a documentação atual no Context7 (`resolve-library-id`, depois `query-docs`): a versão estável mais recente e a API dela. Numa major, leia o guia de migração antes de mudar o código. Sem a biblioteca no Context7, use a documentação oficial na web.

3. Para um pacote novo, prefira as bibliotecas oficiais e as recomendadas pela documentação do framework, como os pacotes `@nestjs/*`, a alternativas de terceiros, salvo justificativa explícita no PR.

4. Instale a latest:

   ```bash
   npm install <pacote>@latest
   ```

   Com `--save-dev` para uma dependência de desenvolvimento. O `prettier` vai com a versão exata, e a nova formatação num commit só:

   ```bash
   npm install --save-dev --save-exact prettier@latest
   npm run format
   ```

5. Se a latest quebra outro pacote, instale a maior versão compatível e registre a exceção na tabela, com o motivo e o gatilho. No mesmo PR, acrescente o `ignore` correspondente ao `.github/dependabot.yml`, na mesma faixa da linha.

6. Ao destravar uma exceção, tire a linha da tabela e o `ignore` do `.github/dependabot.yml` no mesmo PR, e faça o ajuste do pacote:

   - `ioredis` 6: revise `BullMqConnection`, `RedisThrottlerStorage` e o `keys` do e2e de throttle. `protocol: 2` mantém o formato do 5.
   - `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` e `@nestjs/testing`: volte os quatro ao `^`, juntos, na latest.

7. Na descrição do PR, informe a versão consultada e por que ela é a recomendada.

## Fechar um PR do Dependabot

Na branch do PR:

1. Num PR de imagem, que muda só o `docker-compose.yml`, atualize as outras ocorrências da imagem, listadas em [Versões e exceções → Atualização automática](../reference/versoes-e-excecoes.md#atualização-automática). Numa major do Postgres, recrie o volume local: [Como resetar o ambiente local](resetar-o-ambiente-local.md).
2. Se o `check` falha no `openapi:check`, como num PR do `@nestjs/swagger` ou do grupo `nestjs`, regere o `openapi.json` e commite-o: [Como atualizar o contrato OpenAPI](atualizar-o-contrato-openapi.md).

O PR de uma action já traz o `actions.lock`.

## Como verificar

- `npm run ci` passa. Numa dependência de banco, Redis, filas ou HTTP, `npm run test:int` e `npm run test:e2e` também.
- `npm outdated` lista só os pacotes da tabela de exceções.
- O `.github/dependabot.yml` tem um `ignore` para cada linha da tabela, menos o `argon2`.

## Veja também

- [Versões e exceções](../reference/versoes-e-excecoes.md): a regra, as exceções e o Dependabot.
- [ADR 0012](../adr/0012-cadeia-de-suprimentos-do-ci.md): por que o Dependabot, os grupos e o `ignore` pela faixa da exceção.
- [Como mudar uma action do CI](mudar-uma-action-do-ci.md): o `uses:` e o `actions.lock`.
