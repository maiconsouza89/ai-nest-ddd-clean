---
type: how-to
---

# Como paginar uma listagem

Use este guia para expor uma rota `GET` que devolve uma lista em páginas, como `GET /v1/orders` e `GET /v1/products`. A leitura fica numa query, e não no repositório do agregado ([Consistência e eventos](../explanation/consistencia-e-eventos.md#leitura-sem-agregado-cqrs-leve)).

## Pré-requisitos

- O módulo e a tabela da lista já existem.
- Decida quem pode ver o quê. Uma lista "dos meus" recebe o id do ator e filtra na própria query ([Camadas](../reference/camadas.md#application)).

## Passos

1. No controller, receba a página com o `PaginationQuery` do shared e repasse o ator, se a lista for por dono:

   ```ts
   import { PaginationQuery } from '#shared/infra/http/pagination.query';

   @Get()
   list(@Query() query: PaginationQuery, @CurrentUser() actor: Actor) {
     return this.orderQueries.listByCustomer(actor.id, query);
   }
   ```

   O `PaginationQuery` aceita `page` a partir de 1 (padrão 1) e `limit` de 1 a 100 (padrão 20). Fora disso, a resposta é 400. Os padrões e a conversão de texto para número vêm do `ValidationPipe` com `transform: true`, que o `configureApp` já liga.

2. Declare a query em `application/queries/<nome>.queries.ts`, com o item no formato da tela e o `Page` e o `PageRequest` de `#shared/application/page`:

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

3. Implemente a query em `infra/database/typeorm/typeorm-<nome>.queries.ts`. Ordene sempre por um campo que não se repete no fim da ordenação, em geral o `id`. Sem esse desempate, itens com o mesmo valor trocam de posição entre uma consulta e outra, e repetem ou somem entre as páginas.

   - **Uma linha por item, sem somar filhos:** use o `findAndCount` do repositório, com `skip` e `take`. É o caso do catalog:

     ```ts
     const [items, total] = await this.products.findAndCount({
       order: { name: 'ASC', id: 'ASC' },
       skip: (page - 1) * limit,
       take: limit,
     });
     return { items, total, page, limit };
     ```

   - **Com totais calculados dos filhos:** use o query builder com `GROUP BY` e `getRawMany`, com `offset` e `limit`. Cada linha do resultado é um item da lista, então o `LIMIT` do SQL conta itens. O `skip` e o `take` do TypeORM são para `getMany` com joins, em que um item ocupa várias linhas. Conte o total numa consulta à parte e converta para número o que vem de `COUNT` e `SUM`, porque o driver do Postgres devolve esses valores como texto. É o caso do orders:

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

### Lista grande ou rolagem infinita: cursor

Com `offset`, o banco ainda percorre as linhas puladas, e a página 500 custa mais que a primeira. Um item inserido entre duas consultas também empurra os outros, e um item se repete na página seguinte. Para uma lista que cresce sem limite ou que é lida por rolagem, troque o número da página pela posição do último item recebido (keyset):

```ts
// cursor = createdAt e id do último item da página anterior
qb.where('(o.createdAt, o.id) < (:createdAt, :id)', cursor)
  .orderBy('o.createdAt', 'DESC')
  .addOrderBy('o.id', 'DESC') // desempate estável
  .limit(limit);
```

Os ids são UUID v7, ordenados pelo momento da criação, e por isso o `id` sozinho pode servir de cursor numa lista ordenada por criação. Nenhuma listagem do projeto usa cursor: a rota passaria a receber `after` no lugar de `page`, e a resposta a devolver o cursor da próxima página em vez do `total`.

## Como verificar

- `npm run test:int -- <nome>.queries` passa.
- Com a aplicação no ar, `GET /v1/<rota>?limit=101` responde 400, e `GET /v1/<rota>?page=2&limit=1` devolve o segundo item da ordenação, com o mesmo `total` da primeira página.

## Veja também

- [Camadas](../reference/camadas.md#application): a query fica na application, e o repositório não pagina.
- [Consistência e eventos](../explanation/consistencia-e-eventos.md#leitura-sem-agregado-cqrs-leve): por que a leitura não passa pelo agregado.
- [orders](../reference/modules/orders.md) e [catalog](../reference/modules/catalog.md): as duas listagens paginadas e os parâmetros delas.
