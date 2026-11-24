---
type: reference
---

# Módulo orders

Pedidos de um cliente, do rascunho ao pagamento ou ao cancelamento.

Código em `src/modules/orders/`, registrado no `src/app.module.ts` como `OrdersModule`.

## Linguagem ubíqua

| Termo | No código | Significado |
| --- | --- | --- |
| Pedido | `Order` | Agregado raiz. Itens, status e versão para a concorrência otimista. |
| Item do pedido | `OrderItem` | Produto, quantidade e preço unitário, dentro do agregado `Order`. O mesmo produto aparece uma vez só, e adicioná-lo de novo soma a quantidade. |
| Cliente | `customerId` | O dono do pedido: o id do usuário que o criou (`actor.id` no `POST /v1/orders`). Não muda depois, nem quando um admin age sobre o pedido. Ver [Usuário, ator e cliente](../glossario.md#usuário-ator-e-cliente). |
| Status | `OrderStatus` | `DRAFT`, `PLACED`, `PAID` ou `CANCELLED`. Ver [Ciclo de vida](#ciclo-de-vida). |
| Criar | `Order.create`, `CreateOrderUseCase` | Abrir o pedido como rascunho, já com os itens e os preços do catalog. |
| Consultar | `GetOrderUseCase` | Ler um pedido com itens e total, para o dono ou um admin. |
| Fechar | `place()`, `PlaceOrderUseCase` | Reservar o estoque e confirmar o pedido. Depois disso os itens não mudam. |
| Pagar | `pay()`, `PayOrderUseCase` | Cobrar o total no fornecedor de pagamento. |
| Cancelar | `cancel()`, `CancelOrderUseCase` | Desistir do pedido antes do pagamento. O inventory repõe o estoque reservado. |
| Expirar | `ExpirePendingOrdersUseCase` | Cancelar, pelo job, um pedido parado há mais de `ORDER_EXPIRATION_MINUTES`. É um cancelamento como outro qualquer. |
| Total | `Order.total` | Soma dos subtotais (preço unitário × quantidade), em `Money`. |
| Chave de idempotência | `Idempotency-Key`, `IdempotencyStore` | Cabeçalho opcional do pagamento. Ver [Idempotency key](../glossario.md#idempotency-key). |

## Ciclo de vida

| De | Para | Ação | Evento | Recusada com |
| --- | --- | --- | --- | --- |
| — | `DRAFT` | Criar | `OrderCreated` | `PRODUCT_NOT_FOUND` se um produto não existe no catalog |
| `DRAFT` | `PLACED` | Fechar | `OrderPlaced` | `INSUFFICIENT_STOCK` sem saldo, `ORDER_NOT_EDITABLE` fora de `DRAFT`, `EMPTY_ORDER` sem itens. A reserva vem antes das outras checagens: sem saldo, a resposta é `INSUFFICIENT_STOCK` mesmo fora de `DRAFT`. Em qualquer recusa, nada muda |
| `PLACED` | `PAID` | Pagar | `OrderPaid` | `ORDER_ALREADY_PAID` em `PAID`, `ORDER_NOT_PAYABLE` nos outros, `PAYMENT_UNAVAILABLE` se o fornecedor falhar |
| `DRAFT` ou `PLACED` | `CANCELLED` | Cancelar ou expirar | `OrderCancelled` | `ORDER_NOT_CANCELLABLE` em `PAID` (exigiria estorno) ou `CANCELLED` |

`PAID` e `CANCELLED` são finais.

## Contrato público

- **Facade:** nenhuma. Nenhum módulo chama o orders. Os outros reagem aos [eventos publicados](#eventos-publicados).
- **HTTP:** todas as rotas exigem autenticação ([Rotas protegidas](../autenticacao.md#rotas-protegidas)). Um erro de domínio responde `{ code, message }`.

| Rota | Corpo | Sucesso |
| --- | --- | --- |
| `GET /v1/orders` | Query `page` (padrão 1) e `limit` (1 a 100, padrão 20) | 200 `{ items, total, page, limit }`, só os pedidos do próprio ator. Cada item tem `id`, `status`, `itemCount`, `totalCents`, `currency` e `createdAt`. Passa pelo [cache](#jobs-e-cache): logo depois de uma escrita, pode mostrar o estado anterior |
| `GET /v1/orders/:id` | — | 200 `{ id, customerId, status, items, totalCents, currency }`, cada item com `productId`, `qty`, `unitPriceCents` e `currency`. Sem cache: mostra a última escrita |
| `POST /v1/orders` | `items`: de 1 a 100 `{ productId, qty }`, `qty` inteiro ≥ 1 | 201 `{ id }` |
| `POST /v1/orders/:id/place` | — | 204 |
| `POST /v1/orders/:id/pay` | Cabeçalho opcional `Idempotency-Key` (1 a 255 caracteres) | 204 |
| `POST /v1/orders/:id/cancel` | — | 204 |

`GET /v1/orders/:id`, `place`, `pay` e `cancel` só valem para o dono do pedido ou para um ator com o role `admin`. Um `:id` que não é uuid responde 400 nas quatro.

| Código | HTTP | Quando |
| --- | --- | --- |
| `ORDER_NOT_FOUND` | 404 | O pedido não existe |
| `PRODUCT_NOT_FOUND` | 404 | Um `productId` não existe no catalog |
| `NOT_ORDER_OWNER` | 403 | O ator não é o dono nem admin |
| `ORDER_NOT_EDITABLE` | 409 | Fechar um pedido que não está em `DRAFT` |
| `ORDER_NOT_PAYABLE` | 409 | Pagar um pedido que não está em `PLACED` |
| `ORDER_ALREADY_PAID` | 409 | Pagar um pedido em `PAID` |
| `ORDER_NOT_CANCELLABLE` | 409 | Cancelar um pedido em `PAID` ou `CANCELLED` |
| `INSUFFICIENT_STOCK` | 409 | Fechar sem saldo para um produto, ou com um produto sem estoque cadastrado |
| `CONCURRENCY_CONFLICT` | 409 | O pedido mudou entre a leitura e a gravação |
| `EMPTY_ORDER` | 422 | Fechar um pedido sem itens |
| `IDEMPOTENCY_KEY_REUSED` | 422 | O mesmo ator já usou a `Idempotency-Key` para pagar outro pedido |
| `INVALID_IDEMPOTENCY_KEY` | 400 | `Idempotency-Key` vazia ou com mais de 255 caracteres |
| `PAYMENT_UNAVAILABLE` | 503 | O fornecedor de pagamento falhou ou estourou o tempo em todas as tentativas |
| Outro erro de domínio | 422 | Por exemplo `INVALID_QUANTITY` ou `CURRENCY_MISMATCH` |

## Eventos publicados

Todos saem pela outbox, na mesma transação do pedido. O payload tem só primitivos. O exemplo de cada um fica em `src/modules/orders/contracts/events/`, e um teste de contrato confere o evento gerado contra ele.

| Tipo | Versão | Quando | Payload | Exemplo | Consumido por |
| --- | --- | --- | --- | --- | --- |
| `orders.order-created` | 1 | Criar | `orderId`, `customerId` | `order-created.v1.example.ts` | [orders](#eventos-consumidos) |
| `orders.order-placed` | 1 | Fechar | `orderId`, `customerId` | `order-placed.v1.example.ts` | [orders](#eventos-consumidos) |
| `orders.order-paid` | 1 | Pagar | `orderId`, `customerId`, `totalCents`, `currency` | `order-paid.v1.example.ts` | [orders](#eventos-consumidos), [notifications](notifications.md#eventos-consumidos) |
| `orders.order-cancelled` | 1 | Cancelar ou expirar | `orderId`, `customerId` | `order-cancelled.v1.example.ts` | [orders](#eventos-consumidos), [inventory](inventory.md#eventos-consumidos) |

O efeito de cada consumidor está na seção "Eventos consumidos" do módulo dele.

## Eventos consumidos

| Evento | Publicado por | Consumidor | Efeito |
| --- | --- | --- | --- |
| Os quatro acima | orders | `orders.invalidate-list-cache` (`InvalidateOrderListCacheHandler`) | Troca a geração do cache da listagem do cliente. Não passa pelo `IdempotentConsumer`, porque trocar a geração de novo não causa dano |

## Invariantes

As regras de cada transição estão no [Ciclo de vida](#ciclo-de-vida). Além delas:

| Regra | Erro |
| --- | --- |
| Itens só entram com o pedido em `DRAFT` | `ORDER_NOT_EDITABLE` |
| A quantidade de um item é um inteiro positivo | `INVALID_QUANTITY` |
| O total soma itens na mesma moeda | `CURRENCY_MISMATCH` |
| Duas gravações concorrentes do mesmo pedido: a segunda falha (coluna `version`) | `CONCURRENCY_CONFLICT` |
| O pagamento trava a linha do pedido até o commit: um cancelamento ou expiração concorrente espera e depois falha | `CONCURRENCY_CONFLICT`, `ORDER_NOT_CANCELLABLE` |
| O pagamento cobra com a chave `pay:<orderId>` no fornecedor. Repetir a cobrança do mesmo pedido não cobra duas vezes | — |
| Com `Idempotency-Key`, repetir o pagamento do mesmo pedido responde 204 de novo sem cobrar. A chave é por ator e vale 24 horas | `IDEMPOTENCY_KEY_REUSED` |

## Jobs e cache

- **Expiração:** fila `jobs.orders`, scheduler `orders.expire-pending-orders`, a cada 5 minutos. Cancela até 100 pedidos por execução, os parados há mais tempo primeiro, um por transação. Obedece ao `JOBS_ENABLED` e ao `ORDER_EXPIRATION_MINUTES` ([Workers e jobs](../variaveis-de-ambiente.md#workers-e-jobs)).
- **Cache da listagem:** Redis, 60 segundos por página, chaveado pela geração do cliente (`orders:list-gen:<cliente>`). Um evento do pedido troca a geração. Falha do Redis vira leitura direta do banco.
- **Pagamento:** fornecedor simulado (`SimulatedPaymentGateway`), que aprova tudo. Cada tentativa tem 3 segundos, com uma repetição após 200 ms.

## Dependências

| Módulo | Facade | Port do orders | Uso |
| --- | --- | --- | --- |
| [catalog](catalog.md) | `CatalogFacade.pricesOf` | `PriceCatalog` (`CatalogPriceAdapter`) | Preço dos produtos ao criar o pedido |
| [inventory](inventory.md) | `InventoryFacade.reserve` | `StockGateway` (`InventoryStockGateway`) | Reserva de estoque ao fechar, com o id do pedido como referência |

Também importa o `MessagingModule` do shared, para o job de expiração.

## Schema e migrations

- Schema `orders`, migrations registradas em `orders_migrations`. Aplique com `npm run mig:orders:run`.
- Migrations em `src/modules/orders/infra/database/typeorm/migrations/`.

| Tabela | Conteúdo |
| --- | --- |
| `orders` | `id`, `customerId`, `status`, `version`, `createdAt`, `updatedAt` |
| `order_items` | `orderId` e `productId` (chave), `qty`, `unitPriceCents`, `currency`. Apagada em cascata com o pedido |
| `idempotency_keys` | `actorId` e `key` (chave), `fingerprint`, `expiresAt` |

Os eventos ficam na tabela `shared.outbox`, do shared (`npm run mig:outbox:run`).

## Decisões

- [ADR 0002](../../adr/0002-ator-carregado-por-requisicao.md): o ator chega ao caso de uso carregado a cada requisição, com os roles do banco.
- [ADR 0003](../../adr/0003-imports-explicitos-entre-modulos.md): o orders importa o `CatalogModule` e o `InventoryModule` e usa só as facades deles.
