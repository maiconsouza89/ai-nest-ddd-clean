---
type: how-to
---

# Como criar um módulo

Use este guia para um módulo de negócio com regras próprias. O gerador cria um CRUD mínimo com todas as camadas, que serve de ponto de partida. Um cadastro que só valida campos pode ser CRUD direto, sem as camadas, como o catalog ([Nem todo módulo precisa das camadas](../explanation/arquitetura.md#nem-todo-módulo-precisa-das-camadas)).

## Pré-requisitos

- Postgres e Redis no ar: `docker compose up -d postgres redis` ([Comandos](../reference/comandos.md#setup-do-zero)).
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
   - **Erro novo:** acrescente o `code` e o status HTTP na tabela `STATUS` do `infra/http/filters/domain-error.filter.ts` ([Modelagem do domínio](../explanation/modelagem-do-dominio.md)).
   - **Rota:** o controller sai com `@Controller('<nome>')`, no singular. Troque o caminho se o recurso pedir outro (`orders`, `products`).
   - **Schema:** cada mudança numa ORM entity segue [Como gerar uma migration](gerar-uma-migration.md).

4. Se outro módulo vai usar este, crie a facade em `contracts/<nome>.facade.ts`, ligue-a no módulo Nest e exporte só ela. Quem consome declara o `<Nome>Module` no `imports` ([ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md)). Para avisar outros módulos de um fato, siga [Como publicar um evento de integração](publicar-um-evento-de-integracao.md).

5. Preencha `docs/reference/modules/<nome>.md` e apague os comentários do template. No índice de `docs/README.md`, escreva a descrição de uma linha depois do link que o gerador pôs. Cada termo da seção "Linguagem ubíqua" entra no índice do [Glossário](../reference/glossario.md).

## Como verificar

- `npm run ci` passa ([Verificação](../reference/comandos.md#verificação)). O `docs:check` falha enquanto sobrar comentário de template na página do módulo.
- `npm run test:int -- <nome>` passa.
- Com a app no ar (`npm run start:dev`), as rotas respondem:
  - `POST /v1/<nome>` sem token: 401;
  - com o `accessToken` do login e `{ "name": "..." }`: `{ id }`;
  - `GET /v1/<nome>/<id>`: `{ id, name }`;
  - `GET` com um uuid que não existe: 404, com o `code` do nome em constant case (`price-list` → `PRICE_LIST_NOT_FOUND`).

Antes do PR, confira o que nenhum check pega:

- [ ] O `create` da entidade aplica as regras, e o `restore` só reconstrói ([Camadas](../reference/camadas.md#domain)).
- [ ] Valor em dinheiro usa o `Money`, e preço vem do servidor, nunca da requisição ([Modelagem do domínio](../explanation/modelagem-do-dominio.md)).
- [ ] Se o recurso tem dono, o controller passa o `@CurrentUser()`, o caso de uso confere o dono e a query filtra pelo ator ([Autenticação e ownership](../explanation/autenticacao.md)).
- [ ] Filhos do agregado são salvos pela raiz ([Convenções](../reference/convencoes.md#typeorm)).
- [ ] Gravação disputada usa a versão do repositório gerado ou um update condicional ([Consistência e eventos](../explanation/consistencia-e-eventos.md)).
- [ ] Nenhuma FK, join ou transação com tabela de outro módulo ([Camadas](../reference/camadas.md#entre-módulos)).
- [ ] Toda listagem é paginada, com limite máximo ([Como paginar uma listagem](paginar-uma-listagem.md)).
- [ ] Cada evento publicado tem teste de contrato ([Testes](../reference/testes.md)).

Consumidor de evento, cache, job e chamada a fornecedor seguem a página de cada um: [Como publicar um evento de integração](publicar-um-evento-de-integracao.md), [Como cachear uma leitura](cachear-uma-leitura.md), [Como agendar um job](agendar-um-job.md) e [Serviços externos](../explanation/servicos-externos.md).

## Veja também

- [Camadas](../reference/camadas.md): o que fica em cada camada e em qual pasta.
- [Arquitetura](../explanation/arquitetura.md): por que cada módulo tem camadas e por que o Nest fica só na infra.
- [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md): schema próprio, dependência numa direção só e a facade que devolve resultado.
- [Shared kernel](../explanation/shared-kernel.md): por que regra de negócio não vai para o `src/shared/`.
