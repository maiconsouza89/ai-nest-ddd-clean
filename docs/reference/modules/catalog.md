---
type: reference
---

# Módulo catalog

Cadastro de produtos e fonte dos preços que os pedidos usam.

Código em `src/modules/catalog/`, registrado no `src/app.module.ts` como `CatalogModule`.

## Estrutura

O catalog é CRUD direto: controller, service e repositório do TypeORM, sem as pastas `domain/`, `application/` e `infra/`. É intencional. O módulo só valida campos e não tem regra de negócio, e nesse caso o projeto usa CRUD e passa para a estrutura completa quando surgir regra ([Nem todo módulo precisa das camadas](../../explanation/arquitetura.md#nem-todo-módulo-precisa-das-camadas)). O isolamento vale do mesmo jeito: o módulo exporta só a `CatalogFacade`, de `contracts/`.

## Linguagem ubíqua

| Termo | No código | Significado |
| --- | --- | --- |
| Produto | `ProductOrmEntity` | Item vendável, com nome e preço. Outros módulos o conhecem só pelo id. |
| Preço | `priceCents`, `currency` | Inteiro em centavos e moeda de 3 letras. A moeda é `BRL` e a API não a altera. |
| Preço do produto | `ProductPrice` | O que a facade devolve: `productId`, `priceCents` e `currency`. O orders converte em `Money`. |

## Contrato público

**Facade:** `CatalogFacade`, em `src/modules/catalog/contracts/catalog.facade.ts`.

| Método | Devolve |
| --- | --- |
| `pricesOf(productIds: string[])` | `ProductPrice[]`, só dos produtos que existem. Ids desconhecidos ou que não são uuid ficam de fora, e uma lista vazia devolve `[]` |

**HTTP:** todas as rotas exigem autenticação ([Rotas protegidas](../autenticacao.md#rotas-protegidas)).

| Rota | Role | Corpo | Sucesso |
| --- | --- | --- | --- |
| `GET /v1/products` | — | Query `page` (padrão 1) e `limit` (1 a 100, padrão 20) | 200 `{ items, total, page, limit }`, por nome e depois id |
| `GET /v1/products/:id` | — | — | 200 com o produto |
| `POST /v1/products` | `admin` | `name` (1 a 120), `priceCents` (inteiro de 0 a 1.000.000.000) | 201 com o produto |
| `PATCH /v1/products/:id` | `admin` | `name` e `priceCents`, os dois opcionais, com os mesmos limites. Um campo enviado como `null` dá 400 | 200 com o produto |

O produto tem `id`, `name`, `priceCents`, `currency`, `createdAt` e `updatedAt`. Um `:id` que não é uuid dá 400, e um produto inexistente dá 404 no formato padrão do Nest (`{ statusCode, message, error }`), não `{ code, message }`.

## Eventos publicados

Nenhum. Mudar o preço não afeta pedidos já criados, que guardam o preço unitário do momento da criação.

## Eventos consumidos

Nenhum.

## Invariantes

- O nome é gravado sem espaços nas pontas.
- O preço é um inteiro de centavos, de 0 a 1.000.000.000 (a coluna é `int` de 32 bits).

As duas regras ficam na validação do corpo e no service. Não há erro de domínio.

## Dependências

Nenhum módulo de negócio.

## Schema e migrations

- Schema `catalog`, migrations registradas em `catalog_migrations`. Aplique com `npm run mig:catalog:run`.
- Migrations em `src/modules/catalog/database/migrations/`.

| Tabela | Conteúdo |
| --- | --- |
| `products` | `id`, `name` (até 120), `priceCents`, `currency` (padrão `BRL`), `createdAt`, `updatedAt` |

**Seed** (`npm run seed:catalog`): três produtos com ids fixos, os mesmos do seed do [inventory](inventory.md#schema-e-migrations). Insere só o que falta.

## Decisões

- [ADR 0003](../../adr/0003-imports-explicitos-entre-modulos.md): o catalog exporta só a facade, e quem a usa importa o `CatalogModule`.
