---
type: how-to
---

# Como criar um módulo

Use este guia para criar um módulo de negócio com regras próprias, a partir do CRUD com todas as camadas que o gerador cria.

## Pré-requisitos

- O módulo tem regras próprias. Um cadastro que só valida campos pode ser CRUD direto, sem as camadas, como o catalog ([Nem todo módulo precisa das camadas](../explanation/arquitetura.md#nem-todo-módulo-precisa-das-camadas)).
- Postgres e Redis no ar: `docker compose up -d postgres redis` ([Como preparar o ambiente local](preparar-o-ambiente-local.md)).
- Um nome no singular, em kebab-case (`shipment`, `price-list`). Ele vira a pasta, o schema, a tabela, a rota e o prefixo das classes.

## Passos

1. Gere o módulo:

   ```bash
   npm run plop module <nome>
   ```

   Ele cria um CRUD de exemplo (`id`, `name` e `version`) em todas as camadas, com os testes unitários e de integração, e lista os arquivos no terminal. O que mais ele registra está em [Comandos](../reference/comandos.md#geradores).

2. Aplique as migrations do módulo:

   ```bash
   npm run mig:<nome>:run
   ```

3. Troque o CRUD gerado pelo modelo do módulo: entidade e value objects com as invariantes, erros de domínio, casos de uso e ports, cada peça na pasta indicada em [Camadas](../reference/camadas.md).
   - **Erro novo:** acrescente o `code` e o status HTTP no `<NOME>_ERROR_STATUSES` do `infra/http/error-statuses.ts`. Um `code` fora do mapa responde 422 ([Respostas de erro](../reference/respostas-de-erro.md)). Uma resposta de erro nova da rota entra no Swagger com `@ApiProblemResponse(status, descrição)`.
   - **Rota:** o controller sai com `@Controller('<nome>')`, no singular. Troque o caminho se o recurso pedir outro (`orders`, `products`).
   - **Schema:** cada mudança numa ORM entity segue [Como gerar uma migration](gerar-uma-migration.md).
   - **Resposta de sucesso:** a rota com corpo tem uma classe em `infra/http/dtos/<nome>.responses.ts`, o decorator `@ApiOkResponse({ type })` ou `@ApiCreatedResponse({ type })` e a classe no tipo de retorno do método. O gerador já cria o `Created<Nome>Response` e o `<Nome>Response`: mude os campos junto com o retorno dos casos de uso ([Camadas](../reference/camadas.md#infra)).
   - **Contrato:** depois de criar o controller e os DTOs, rode `npm run openapi:generate` e commite o `openapi.json` ([Operação → Swagger](../reference/operacao.md#swagger)). O gerador falha se uma rota não documenta a resposta de sucesso, ou se um 200 ou 201 não descreve o corpo.

4. Se outro módulo vai usar este, crie a facade em `contracts/<nome>.facade.ts`, ligue-a no módulo Nest e exporte só ela. Quem consome declara o `<Nome>Module` no `imports` ([ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md)). Para avisar outros módulos de um fato, siga [Como publicar e consumir um evento de integração](publicar-um-evento-de-integracao.md).

5. Revise o módulo contra o [checklist](../reference/camadas.md#checklist) do que nenhum check pega. Consumidor de evento, cache, job e chamada a fornecedor seguem a página de cada um: [Como publicar e consumir um evento de integração](publicar-um-evento-de-integracao.md), [Como cachear uma leitura](cachear-uma-leitura.md), [Como agendar um job](agendar-um-job.md) e [Serviços externos](../explanation/servicos-externos.md).

6. Preencha `docs/reference/modules/<nome>.md` e apague os comentários do template. No índice de `docs/README.md`, escreva a descrição de uma linha depois do link que o gerador pôs. Cada termo da seção "Linguagem ubíqua" entra no índice do [Glossário](../reference/glossario.md).

## Como verificar

- `npm run ci` passa ([Verificação](../reference/comandos.md#verificação)). O `docs:check` falha enquanto sobrar comentário de template na página do módulo, e o `openapi:check`, enquanto o `openapi.json` não tiver as rotas novas.
- `npm run test:int -- <nome>` passa.
- Com a app no ar (`npm run start:dev`), as rotas respondem:
  - `POST /v1/<nome>` sem token: 401;
  - com o `accessToken` do login e `{ "name": "..." }`: `{ id }`;
  - `GET /v1/<nome>/<id>`: `{ id, name }`;
  - `GET` com um uuid que não existe: 404, com o `code` do nome em constant case (`price-list` → `PRICE_LIST_NOT_FOUND`).

## Veja também

- [Camadas](../reference/camadas.md): o que fica em cada camada e em qual pasta.
- [Arquitetura](../explanation/arquitetura.md): por que cada módulo tem camadas e por que o Nest fica só na infra.
- [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md): schema próprio, dependência numa direção só e a facade que devolve resultado.
- [Shared kernel](../explanation/shared-kernel.md): por que regra de negócio não vai para o `src/shared/`.
