---
type: how-to
---

# Como cachear uma leitura

Use este guia quando uma query de listagem ou de consulta pesa no Postgres e pode ficar alguns segundos desatualizada, como a listagem de pedidos do orders (`CachedOrderQueries`).

## Pré-requisitos

- A leitura é uma query, com port em `application/queries/` e implementação na infra ([Como paginar uma listagem](paginar-uma-listagem.md)). Cache nunca carrega um agregado que vai ser alterado.
- Toda escrita que muda o resultado da leitura publica um evento de integração. Sem o evento, a leitura fica velha até o TTL. Se falta um, publique-o antes ([Como publicar e consumir um evento de integração](publicar-um-evento-de-integracao.md)).
- Redis no ar para rodar a app: `docker compose up -d redis`.

## Passos

1. Crie o decorator em `infra/cache/cached-<leitura>.queries.ts`. Ele implementa o mesmo port e recebe a implementação de verdade, o `Cache` do `@nestjs/cache-manager`, o `Logger` e o TTL:

   ```ts
   export class CachedOrderQueries implements OrderQueries {
     constructor(
       private readonly inner: OrderQueries,
       private readonly cache: Cache,
       private readonly logger: Logger,
       private readonly ttlMs: number,
     ) {}

     async listByCustomer(customerId: string, request: PageRequest) {
       const key = await this.pageKey(customerId, request); // null: sem geração, sem cache
       if (key) {
         const hit = await this.read(key);
         if (hit) return hit;
       }
       const fresh = await this.inner.listByCustomer(customerId, request);
       if (key) await this.write(key, fresh);
       return fresh;
     }

     async invalidate(customerId: string) {
       // nova geração: as páginas antigas deixam de ser lidas e expiram pelo TTL
       await this.cache.set(this.generationKey(customerId), randomUUID(), this.ttlMs * 2);
     }
   }
   ```

   Siga o arquivo completo do orders e cumpra estas regras:
   - **Chave com geração:** guarde a geração do escopo em `<módulo>:<leitura>-gen:<escopo>` e cada resultado em `<módulo>:<leitura>:<escopo>:<geração>:<parâmetros>`. O escopo é o que uma escrita invalida de uma vez (o cliente, no orders). Sem geração gravada, use a inicial, `'0'`.
   - **TTL em toda chave:** grave o resultado com o TTL e a geração com o dobro dele ([Redis](../explanation/redis.md#cache-da-leitura)).
   - **Falha do cache não derruba a leitura:** ponha cada chamada ao cache num `try/catch` que registra um `warn` e segue para o banco. Se a leitura da geração falhar, não use o cache nem grave o resultado.
   - **Datas:** converta de volta para `Date` as datas lidas do cache.

2. Ligue o decorator no módulo Nest, no lugar da implementação. Quem injeta o port recebe a versão com cache:

   ```ts
   // rede de segurança: limita o pior caso se uma invalidação por evento se perder
   const ORDER_LIST_CACHE_TTL_MS = 60_000;

   TypeOrmOrderQueries,
   {
     provide: CachedOrderQueries,
     useFactory: (inner: TypeOrmOrderQueries, cache: Cache, logger: Logger) =>
       new CachedOrderQueries(inner, cache, logger, ORDER_LIST_CACHE_TTL_MS),
     inject: [TypeOrmOrderQueries, CACHE_MANAGER, Logger],
   },
   { provide: OrderQueries, useExisting: CachedOrderQueries },
   ```

   O `CACHE_MANAGER` vem do `AppCacheModule` do `shared`, que é global.

3. Crie o handler de invalidação em `infra/events/invalidate-<leitura>-cache.handler.ts`. Ele escuta todo evento que muda o resultado e chama o `invalidate` do decorator, injetado pela classe concreta:

   ```ts
   @Injectable()
   export class InvalidateOrderListCacheHandler {
     constructor(private readonly queries: CachedOrderQueries) {}

     @IntegrationEventHandler({
       events: ['orders.order-created', 'orders.order-placed', 'orders.order-paid', 'orders.order-cancelled'],
       consumer: 'orders.invalidate-list-cache',
     })
     onOrderListChanged(event: OrderListChanged) {
       return this.queries.invalidate(event.payload.customerId);
     }
   }
   ```

   Trocar a geração é idempotente, então o handler dispensa o `IdempotentConsumer`. Registre-o nos `providers` do módulo.

4. Escreva os testes unitários em `infra/cache/cached-<leitura>.queries.spec.ts`, com o `FakeCache` de `#test/fakes/fake-cache` (`failing = true` simula o Redis fora do ar). Cubra os casos do `cached-order.queries.spec.ts`:
   - a segunda leitura igual vem do cache;
   - a data volta como `Date`;
   - cada escopo e cada página têm a sua entrada;
   - invalidar um escopo não mexe nos outros;
   - invalidar duas vezes é inofensivo;
   - toda chave tem TTL;
   - com o cache falhando, a leitura responde, invalidar não lança e nada é gravado.

5. Escreva o teste de integração em `infra/cache/cached-<leitura>.queries.int-spec.ts`, a partir do `cached-order.queries.int-spec.ts`. Ele sobe Postgres e Redis descartáveis e confere a invalidação pelo handler, o TTL real no Redis e a leitura com o Redis parado.

6. Na doc do módulo, em `docs/reference/modules/<módulo>.md`, descreva o cache (TTL, chave, o que invalida) e acrescente o handler à tabela de eventos consumidos.

## Como verificar

- `npm test -- cached-<leitura>` e `npm run test:int -- cached-<leitura>` passam.
- Com a app no ar, depois de uma chamada à rota, a chave aparece no Redis: `docker compose exec redis redis-cli --scan --pattern '<módulo>:<leitura>:*'` (num worktree, acrescente `-n <N>`, o slot dele). Uma escrita no recurso faz a chamada seguinte vir atualizada assim que o evento sai da outbox.
- No checkout principal, com o Redis parado (`docker compose stop redis`) e a app rodando com `THROTTLE_ENABLED=false`, a rota continua respondendo, e o log mostra os avisos do Redis (`redis connection error`, `cache store error`). Suba o Redis de novo com `docker compose start redis`.

## Veja também

- [Redis](../explanation/redis.md#cache-da-leitura): por que geração em vez de apagar chaves, o TTL como rede de segurança e a consistência eventual.
- [Camadas](../reference/camadas.md#infra): as linhas "Cache" e "Handler de evento".
- [orders](../reference/modules/orders.md#jobs-e-cache): o cache da listagem de pedidos.
