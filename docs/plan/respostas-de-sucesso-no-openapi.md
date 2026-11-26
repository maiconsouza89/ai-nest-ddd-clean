# Plano da documentação no OpenAPI das respostas de sucesso (#56)

A issue #56 pede que o `openapi.json` descreva o corpo das respostas de sucesso. Desde a #23, o CI compara o documento do PR com o da base pelo `oasdiff`, mas remover ou renomear um campo de uma resposta de sucesso não muda o arquivo, e nada acusa. O documento gerado a partir da `main` (`e1e6137`):

| Rota | Sucesso documentado |
| --- | --- |
| `POST /v1/auth/register` | 201 sem corpo. Devolve `{ id }` |
| `POST /v1/auth/login` e `POST /v1/auth/refresh` | Nenhuma 2xx. Devolvem `accessToken`, `expiresIn` e `refreshToken` |
| `GET /v1/orders` e `GET /v1/orders/{id}` | `{ "type": "object" }` |
| `POST /v1/orders` | 201 sem corpo. Devolve `{ id }` |
| `GET /v1/products` | `{ "type": "object" }` |
| `POST /v1/products`, `GET /v1/products/{id}` e `PATCH /v1/products/{id}` | `$ref` para o `ProductOrmEntity`, um schema sem propriedades |
| `GET /health/live` | 200 sem schema. Devolve o `HealthCheckResult` do Terminus |

**Mudanças em relação ao texto da issue:**

- **O `@ApiProblemResponse` desliga a resposta automática.** O plugin da CLI só gera a resposta de sucesso pelo tipo de retorno quando a rota não tem decorator de sucesso (`hasExplicitApiResponseDecorator`, em `@nestjs/swagger/dist/plugin/visitors/controller-class.visitor.js`). Ele trata como de sucesso todo decorator `Api<X>Response` cujo `<X>` não é um `HttpStatus`, e o `ApiProblemResponse` cai nessa regra. É por isso que o login e o refresh não têm 2xx. A convenção pede o decorator de sucesso explícito em toda rota com corpo, e não a inferência pelo tipo de retorno.
- **O `GET /health/live` entra.** Ele tem corpo de sucesso e fica no `shared`, fora dos três módulos da issue.
- **O gerador passa a recusar uma rota com corpo sem schema.** O "Pronto quando" ("toda rota com corpo de resposta de sucesso tem o schema dele") vira uma regra conferida no `openapi:generate` e no `openapi:check`, e não só uma conferência no PR.

Tudo entra em **um PR**, na branch `docs/respostas-de-sucesso-no-openapi`. O plano nasce e é apagado no mesmo PR. O registro, com a prova feita depois do merge, fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-26, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Campos da classe de resposta | Pelo plugin da CLI: `.response.ts` e `.responses.ts` entram no `dtoFileNameSuffix` do `nest-cli.json`, ao lado dos sufixos dos requests. Obrigatório e opcional saem do `!` e do `?`, e a descrição, do `/** */`. `@ApiProperty` explícito só onde o tipo não basta, como um `example` ou um `format`. A alternativa, `@ApiProperty` em todo campo como no `ProblemDetailsResponse`, funcionaria nos testes do Vitest, que compilam com o oxc e sem o plugin, mas são uns 40 campos decorados à mão, com o tipo e o decorator podendo divergir |
| Ligação com o resultado do caso de uso | Pelo tipo de retorno: o método do controller declara `Promise<XResponse>` e devolve o resultado do caso de uso como hoje. O `tsc` confere que o resultado tem todo campo que a classe promete. Sem mapeamento e sem mudança de comportamento. O preço: um campo a mais no resultado sai na resposta sem estar no documento, o que não quebra cliente. A alternativa, um mapeamento explícito por resposta, deixaria o corpo igual ao documento, com mais código por rota e o risco de mudar o corpo de hoje |
| Decorator na rota | Sempre explícito: `@ApiOkResponse({ type })` ou `@ApiCreatedResponse({ type })`, e `@ApiPageResponse(Item)` nas listagens. Não depende da inferência do plugin, que o `@ApiProblemResponse` desliga |
| Envelope da paginação | `src/shared/infra/http/page.response.ts`, com a classe `PageResponse` (`total`, `page` e `limit`) e o decorator `ApiPageResponse(model)`. O decorator registra os dois modelos com `ApiExtraModels` e documenta o 200 com `allOf: [{ $ref: PageResponse }, { properties: { items: <array de $ref model> }, required: ['items'] }]`, como no "Advanced: Generic ApiResponse" da documentação do Nest. O `items` fica fora da classe, porque o genérico não tem metadado em tempo de execução. O tipo de retorno do controller continua `Page<ItemResponse>`, de `#shared/application/page` |
| Onde fica a classe | `infra/http/dtos/<nome>.response.ts` ou `<nome>.responses.ts` do módulo, ao lado dos requests. No catalog, sem camadas, `dtos/product.response.ts` |
| Nomes dos schemas | Únicos no documento, porque o schema leva o nome da classe: `RegisteredUserResponse`, `SessionResponse`, `CreatedOrderResponse`, `OrderListItemResponse`, `OrderDetailsResponse`, `OrderItemResponse`, `ProductResponse` e `PageResponse`. O `{ id }` do identity e o do orders ficam duplicados, cada um no seu módulo ([Camadas → Shared](../reference/camadas.md#shared)) |
| Datas | Tipadas como `Date` na classe. O plugin gera `string` com `format: date-time`, que é o que o JSON leva |
| `status` do pedido | `string`, como no `OrderListItem` e no `OrderDetails`. Um `enum` pediria mudar o tipo da query |
| `GET /health/live` | `@ApiOkResponse({ description, schema: { $ref: getSchemaPath('TerminusHealthCheckResult') } })`, o schema que o `@HealthCheck()` do ready já registra. O `/health/ready` fica como está |
| Guarda contra rota sem schema | Uma função pura `findUndocumentedSuccessResponses(document)` em `src/shared/infra/http/`, com spec, chamada pelo `src/openapi.ts` antes de gravar ou comparar. Ela lista toda operação com 200 ou 201 sem `content`, com o schema `{ "type": "object" }` sem propriedades ou com `$ref` para um schema sem propriedades, e o gerador falha com a lista. Roda no `openapi:generate` e no `openapi:check`, e por isso no `npm run ci`. No `test/docs.e2e-spec.ts`, um teste confere que toda operação 200 ou 201 tem schema: o oxc não roda o plugin, mas o decorator explícito registra o `$ref` |
| Tipo do commit e do PR | `docs(api)`: muda o documento do contrato, sem mudar o comportamento da API |
| ADR | Não entra. A convenção cabe no `camadas.md` e no `operacao.md`, e nenhuma decisão registrada muda |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Mapear o resultado para o corpo, sem deixar sair campo não documentado | Não entra (decisão "Ligação com o resultado do caso de uso") |
| `enum` no `status` do pedido | Não entra: muda o tipo da query |
| Schema do `/health/ready` | Sem mudança: o Terminus já o documenta |
| `example` em todo campo | Só onde ajuda a leitura |

## Referências

- Issue #56: `gh issue view 56`. Registro da #23, com a decisão "Escopo das respostas": `gh issue view 23 --comments`.
- `@nestjs/swagger` 12.1.2, instalado. Consultado no Context7 em 2026-11-26, em `/nestjs/docs.nestjs.com`: "OpenAPI → Operations → Advanced: Generic ApiResponse" (`ApiExtraModels`, `getSchemaPath` e `allOf`) e "Types and parameters → Generics and interfaces" (genérico sem metadado em tempo de execução).
- Código do plugin lido em `node_modules`: `@nestjs/swagger/dist/plugin/visitors/controller-class.visitor.js` (`hasExplicitApiResponseDecorator` e `isSuccessOrRedirectApiResponseArg`).
- Código:
  - `src/shared/infra/http/swagger.setup.ts`, `problem-details.response.ts` e `pagination.query.ts`;
  - `src/shared/application/page.ts`;
  - `src/shared/infra/health/health.controller.ts`;
  - `src/openapi.ts` e `nest-cli.json`;
  - `src/modules/identity/infra/http/controllers/auth.controller.ts`, `application/session-issuer.ts` e `application/ports/token-issuer.ts`;
  - `src/modules/orders/infra/http/controllers/orders.controller.ts` e `application/queries/order.queries.ts`;
  - `src/modules/catalog/products.controller.ts`, `products.service.ts` e `product.orm-entity.ts`;
  - `test/docs.e2e-spec.ts`;
  - `plop-templates/module/controller.hbs` e `plopfile.mjs`.
- Páginas a mudar:
  - `docs/reference/camadas.md` (Estrutura de pastas, Infra e Shared);
  - `docs/reference/operacao.md` (Swagger);
  - `docs/how-to/paginar-uma-listagem.md`;
  - `docs/how-to/criar-um-modulo.md`;
  - `docs/reference/modules/<módulo>.md`, só se descreverem o corpo das rotas.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): nenhuma trilha aberta mexe nos controllers nem no `operacao.md`. O `openapi.json` se refaz com `npm run openapi:generate` depois de um rebase.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. Aqui: `docs/reference/camadas.md`, `docs/reference/operacao.md`, `docs/how-to/paginar-uma-listagem.md` e `docs/reference/testes.md`.
- Antes de usar uma API do `@nestjs/swagger` que o repositório ainda não usa, confira no Context7.
- Escreva as páginas de forma atemporal, com data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR, comentário na issue e mudança de configuração do repositório no GitHub só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Envelope da paginação, guarda do gerador e health | ⬜ |
| 3 | Respostas dos módulos e template do plop | ⬜ |
| 4 | Testes e prova local com o `oasdiff` | ⬜ |
| 5 | Documentação | ⬜ |
| 6 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. O worktree `.claude/worktrees/issue-56-openapi-respostas`, com `npm run worktree:setup` (slot 1) e a branch `docs/respostas-de-sucesso-no-openapi` a partir da `main` (`e1e6137`) ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Este plano na branch.
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), a #56 na onda 3, trilha H, como 🟡. No `docs/README.md`, o plano na lista "Em andamento" de "Fora dos quadrantes".
4. `npm run docs:check`.
5. Commit: `docs(plan): plano das respostas de sucesso no OpenAPI (#56)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: envelope da paginação, guarda do gerador e health

1. `nest-cli.json`: `.response.ts` e `.responses.ts` no `dtoFileNameSuffix`. Rode `npm run openapi:generate` e confira que o `ProblemDetailsResponse`, que passa a ser lido também pelo plugin, não muda no `openapi.json`. Se mudar, avalie a diferença e registre-a aqui antes de seguir.
2. `src/shared/infra/http/page.response.ts`: `PageResponse` e `ApiPageResponse(model)` (decisão "Envelope da paginação").
3. `src/shared/infra/http/undocumented-success-responses.ts`, com spec: `findUndocumentedSuccessResponses(document)` devolve `"<MÉTODO> <caminho> <status>"` de cada resposta 200 ou 201 sem schema com propriedades. Casos da spec: sem `content`; `{ "type": "object" }`; `$ref` para schema sem propriedades; `$ref` com propriedades; `allOf` com `$ref`; 204 sem corpo, que não conta.
4. `src/openapi.ts`: chama a função depois do `createSwaggerDocument` e, com a lista não vazia, falha com ela e não grava nem compara. Nesse passo a lista ainda tem as rotas dos módulos: o `openapi:generate` só volta a passar no fim do passo 3. Para o commit do passo 2 passar no `openapi:check`, a chamada entra no fim do passo 3, ou o passo 2 e o 3 viram um commit só. Decida na hora e anote aqui.
5. `src/shared/infra/health/health.controller.ts`: o schema do `live` (decisão "`GET /health/live`").
6. `npm run typecheck`, `npm run lint`, `npm test -- undocumented-success-responses`.
7. Commit: `docs(api): envelope da paginação e guarda de resposta sem schema no OpenAPI (#56)`.

### Passo 3: respostas dos módulos e template do plop

1. identity: `src/modules/identity/infra/http/dtos/identity.responses.ts`, com `RegisteredUserResponse` (`id`) e `SessionResponse` (`accessToken`, `expiresIn` e `refreshToken`, com o `/** */` de cada um). No `auth.controller.ts`: `register` com `@ApiCreatedResponse({ type: RegisteredUserResponse })`, `signIn` e `refresh` com `@ApiOkResponse({ type: SessionResponse })`, e o tipo de retorno em cada um.
2. orders: `src/modules/orders/infra/http/dtos/order.responses.ts`, com `CreatedOrderResponse`, `OrderListItemResponse`, `OrderItemResponse` e `OrderDetailsResponse`, com os campos do `OrderListItem` e do `OrderDetails`. No `orders.controller.ts`: `list` com `@ApiPageResponse(OrderListItemResponse)` e `Promise<Page<OrderListItemResponse>>`, `get` com `@ApiOkResponse`, `create` com `@ApiCreatedResponse`.
3. catalog: `src/modules/catalog/dtos/product.response.ts`, com `ProductResponse` (os campos do `ProductOrmEntity`). No `products.controller.ts`: `list` com `@ApiPageResponse(ProductResponse)`, `create` com `@ApiCreatedResponse`, `get` e `update` com `@ApiOkResponse`. O `ProductOrmEntity` sai dos schemas do documento.
4. `plop-templates/module/response.hbs`, com `Created<Nome>Response` e `<Nome>Response`, a entrada no `plopfile.mjs` (`infra/http/dtos/{{kebabCase name}}.responses.ts`) e o `controller.hbs` com os decorators e os tipos de retorno. Gere um módulo de teste com o `plop module`, rode `npm run typecheck` e apague-o.
5. `npm run openapi:generate`. A guarda do passo 2 não acusa nenhuma rota. Confira no `openapi.json` que cada rota da tabela do início tem o schema certo, e que o `required` de cada classe bate com os campos sem `?`.
6. `npm run typecheck`, `npm run lint`, `npm run arch` e `npm run openapi:check`.
7. Commit: `docs(api): documenta as respostas de sucesso do identity, do orders e do catalog (#56)`.

### Passo 4: testes e prova local com o `oasdiff`

1. `test/docs.e2e-spec.ts`: toda operação com 200 ou 201 documenta um schema (`$ref`, `allOf` ou `properties`) em `application/json`.
2. `npm run test:e2e -- docs`, com o `start:dev` deste worktree parado.
3. Prova local com o binário do `oasdiff` na versão do `ci.yml` e `--config .github/oasdiff/config.yaml`, como no registro da #23:
   - `oasdiff breaking main:openapi.json HEAD:openapi.json`: nenhuma quebra. As mudanças esperadas são schema onde não havia, `{ "type": "object" }` trocado por um schema com propriedades e o `ProductOrmEntity` trocado pelo `ProductResponse`. Se acusar alguma, entenda antes de qualquer linha no `err-ignore.txt`, e registre aqui;
   - num commit temporário que tira o `refreshToken` do `SessionResponse` e gera o documento de novo (o `tsc` passa: o resultado continua atribuível à classe): `response-required-property-removed` e saída 1. Desfaça o commit.
4. Commit: `test(docs): toda resposta 200 e 201 do OpenAPI tem schema (#56)`.

### Passo 5: documentação

1. `docs/reference/camadas.md`:
   - na tabela da Infra, a linha "DTO de resposta": `infra/http/dtos/<nome>.response(s).ts`, campos pelo plugin, decorator de sucesso explícito na rota, o tipo de retorno do controller conferido pelo `tsc` contra o resultado do caso de uso, nome de classe único no documento;
   - o `order.responses.ts` na árvore de pastas;
   - o `PageResponse` e o `ApiPageResponse` na linha de infra comum da tabela do Shared.
2. `docs/reference/operacao.md`, seção Swagger:
   - sai a linha "Fora do documento", e entra "Respostas de sucesso": a convenção, o `ApiPageResponse`, o `@ApiProblemResponse` que desliga a resposta automática do plugin e a guarda do gerador;
   - o `dtoFileNameSuffix` com os sufixos novos;
   - a linha do teste com a conferência nova do `docs.e2e-spec.ts`.
3. `docs/how-to/paginar-uma-listagem.md`: o passo do controller com o `@ApiPageResponse(Item)` e o tipo de retorno `Page<ItemResponse>`.
4. `docs/how-to/criar-um-modulo.md`: a classe de resposta no item "Contrato".
5. `docs/reference/modules/identity.md`, `orders.md` e `catalog.md`: só se descreverem o corpo das rotas.
6. `npm run docs:check`.
7. Commit: `docs: convenção das respostas de sucesso no OpenAPI (#56)`.

### Passo 6: verificação, revisão, registro e PR

1. `npm run ci`, `npm run test:e2e` (com o `start:dev` deste worktree parado) e `npm run test:int`.
2. `/simplify` e depois `/code-review` sobre as mudanças (fluxo de entrega do `AGENTS.md`).
3. Registro: o resumo do que foi feito, as mudanças em relação ao plano, a verificação e o plano final num comentário da issue, com o ok do dono. Link para o comentário no `docs/README.md` ("Fora dos quadrantes").
4. Apague este plano e marque a #56 como ✅ no roadmap, com o número do PR.
5. Push e PR com o título `docs(api): documenta no OpenAPI o corpo das respostas de sucesso (#56)`, com o ok do dono. A descrição diz `Refs #56`: a issue fecha depois da prova.
6. Depois do merge, com o ok do dono: um PR de teste em rascunho, a partir da `main`, tira um campo obrigatório de uma resposta de sucesso e gera o `openapi.json` de novo. O job `openapi` falha com `response-required-property-removed`. O PR é fechado sem merge, a branch remota é apagada, e a prova entra no registro. Só então a issue fecha.
