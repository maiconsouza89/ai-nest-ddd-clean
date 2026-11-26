---
type: how-to
---

# Como paginar uma listagem

Use este guia para expor uma rota `GET` que devolve uma lista em páginas, como `GET /v1/orders` e `GET /v1/products`.

## Pré-requisitos

- O módulo e a tabela da lista já existem.
- Decida quem pode ver o quê. Uma lista "dos meus" recebe o id do ator e filtra na própria query ([Camadas](../reference/camadas.md#application)).

## Passos

1. No controller, receba a página com o `PaginationQuery` do shared e repasse o ator, se a lista for por dono. Documente a resposta com o `@ApiPageResponse(<Item>Response)` e declare o retorno como `Page<<Item>Response>`. A classe do item fica em `infra/http/dtos/<nome>.responses.ts` ([Camadas](../reference/camadas.md#infra)):

   ```ts
   import type { Page } from '#shared/application/page';
   import { ApiPageResponse } from '#shared/infra/http/page.response';
   import { PaginationQuery } from '#shared/infra/http/pagination.query';

   @Get()
   @ApiPageResponse(OrderListItemResponse)
   list(
     @Query() query: PaginationQuery,
     @CurrentUser() actor: Actor,
   ): Promise<Page<OrderListItemResponse>> {
     return this.orderQueries.listByCustomer(actor.id, query);
   }
   ```

   Os limites e os padrões de `page` e `limit` estão em [Convenções](../reference/convencoes.md#paginação).

2. Declare a query em `application/queries/<nome>.queries.ts`, e não no repositório do agregado ([Persistência](../explanation/persistencia.md#leitura-sem-agregado-cqrs-leve)), com o item no formato da tela e o `Page` e o `PageRequest` de `#shared/application/page`:

   ```ts
   export type OrderListItem = {
     id: string;
     status: string;
     itemCount: number;
     totalCents: number;
     currency: string;
     createdAt: Date;
   };

   export abstract class OrderQueries {
     abstract listByCustomer(customerId: string, page: PageRequest): Promise<Page<OrderListItem>>;
   }
   ```

   Um módulo sem camadas, como o catalog, pula este passo e pagina direto no service.

3. Implemente a query em `infra/database/typeorm/typeorm-<nome>.queries.ts`. Termine sempre a ordenação por um campo que não se repete, em geral o `id`, para nenhum item se repetir ou sumir entre as páginas.

   - **Uma linha por item, sem somar filhos:** use o `findAndCount` do repositório, com `skip` e `take`. É o caso do catalog:

     ```ts
     const [items, total] = await this.products.findAndCount({
       order: { name: 'ASC', id: 'ASC' },
       skip: (page - 1) * limit,
       take: limit,
     });
     return { items, total, page, limit };
     ```

   - **Com totais calculados dos filhos:** use o query builder com `GROUP BY` e `getRawMany`, com `offset` e `limit`, e não `skip` e `take`. Conte o total numa consulta à parte. Converta para número o que vem de `COUNT` e `SUM`, que o driver do Postgres devolve como texto. É o caso do orders:

     ```ts
     const [total, rows] = await Promise.all([
       orders.countBy({ customerId }),
       orders
         .createQueryBuilder('o')
         .leftJoin('o.items', 'i')
         .where('o.customerId = :customerId', { customerId })
         .select('o.id', 'id')
         .addSelect('o.status', 'status')
         .addSelect('o.createdAt', 'createdAt')
         .addSelect('COUNT(i.productId)', 'itemCount')
         .addSelect('COALESCE(SUM(i.qty * i.unitPriceCents), 0)', 'totalCents')
         .addSelect("COALESCE(MIN(i.currency), 'BRL')", 'currency')
         .groupBy('o.id')
         .orderBy('o.createdAt', 'DESC')
         .addOrderBy('o.id', 'DESC') // desempate estável
         .offset((page - 1) * limit)
         .limit(limit)
         .getRawMany<Row>(),
     ]);
     return {
       items: rows.map((r) => ({
         ...r,
         itemCount: Number(r.itemCount),
         totalCents: Number(r.totalCents),
       })),
       total,
       page,
       limit,
     };
     ```

   A query lê pelo `DataSource` injetado, sem `currentManager`, porque roda fora de caso de uso e de transação.

4. No módulo Nest, ligue o port à implementação: `{ provide: OrderQueries, useClass: TypeOrmOrderQueries }`. O orders liga o `OrderQueries` a um decorator com cache em volta da implementação, e esse é um passo à parte.

5. Escreva o teste de integração da query no modelo de `typeorm-order.queries.int-spec.ts`: só os itens do dono, a ordem, uma lista maior que a página percorrida página a página sem repetir item, e a página vazia.

6. Acrescente a rota à seção HTTP da doc do módulo (`docs/reference/modules/<módulo>.md`), com `page`, `limit`, o formato `{ items, total, page, limit }` e a ordenação.

Uma lista que cresce sem limite ou é lida por rolagem pede paginação por cursor, que nenhuma listagem usa: o gatilho e o desenho estão em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md).

## Como verificar

- `npm run test:int -- <nome>.queries` passa.
- Com a aplicação no ar, `GET /v1/<rota>?limit=101` responde 400, e `GET /v1/<rota>?page=2&limit=1` devolve o segundo item da ordenação, com o mesmo `total` da primeira página.

## Veja também

- [Camadas](../reference/camadas.md#application): a query fica na application, e o repositório não pagina.
- [Persistência](../explanation/persistencia.md#leitura-sem-agregado-cqrs-leve): por que a leitura não passa pelo agregado.
- [orders](../reference/modules/orders.md) e [catalog](../reference/modules/catalog.md): as duas listagens paginadas e os parâmetros delas.
