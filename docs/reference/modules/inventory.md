---
type: reference
---

# Módulo inventory

Saldo de estoque por produto e reservas feitas pelos pedidos.

Código em `src/modules/inventory/`, registrado no `src/app.module.ts` como `InventoryModule`.

## Estrutura

O `domain/` não tem entidade: as regras do saldo são operações atômicas no banco, expostas pelo `StockRepository` (baixa condicional, reserva única por referência). O domínio guarda o contrato do repositório e o erro ([Transações e concorrência](../../explanation/transacoes-e-concorrencia.md)).

## Linguagem ubíqua

| Termo | No código | Significado |
| --- | --- | --- |
| Saldo | `available` (`StockItemOrmEntity`) | Quantidade disponível de um produto. Nunca fica negativa. |
| Reserva | `reservations`, `registerReservation` | Baixa do saldo feita para uma referência, com os itens e as quantidades. |
| Referência | `referenceId` | Quem pediu a reserva. No fluxo de pedidos, o id do pedido. Uma reserva por referência. |
| Reservar | `ReserveStockUseCase`, `InventoryFacade.reserve` | Registrar a reserva e baixar o saldo de cada item, tudo ou nada. |
| Liberar | `ReleaseStockUseCase` | Marcar a reserva como liberada (`releasedAt`) e repor o saldo dos itens. |

## Contrato público

- **Facade:** `InventoryFacade`, em `src/modules/inventory/contracts/inventory.facade.ts`. `reserve({ referenceId, items: { productId, qty }[] })` devolve `{ ok: true }`, ou `{ ok: false, reason: 'INSUFFICIENT_STOCK', productId }` com o primeiro produto sem saldo na ordem de `productId`, e não na ordem dos itens recebidos.
  - Repetir a mesma `referenceId` não reserva de novo e devolve `{ ok: true }`.
  - Com `ok: false`, quem chamou desfaz a transação em andamento. Chamada dentro de uma transação, a facade entra nela e não reverte as baixas feitas antes da falta. Fora de uma transação, ela abre a própria e desfaz tudo.
  - Um produto sem linha em `stock_items` conta como saldo insuficiente.
- **HTTP:** nenhuma rota.

## Eventos publicados

Nenhum.

## Eventos consumidos

| Evento | Publicado por | Consumidor | Efeito |
| --- | --- | --- | --- |
| `orders.order-cancelled` v1 | [orders](orders.md#eventos-publicados) | `inventory.release-on-order-cancelled` (`OnOrderCancelledHandler`) | Libera a reserva do pedido (`referenceId` = `orderId`). Um pedido cancelado antes de fechar não tem reserva, e nada muda |

O handler passa pelo `IdempotentConsumer`: a mesma entrega processada duas vezes repõe o saldo uma vez só. Ele importa só o tipo do evento, não o módulo de orders.

## Invariantes

| Regra | Erro |
| --- | --- |
| O saldo nunca fica negativo: a baixa é condicional (`available >= qty`), e a tabela tem `CHECK ("available" >= 0)` | `INSUFFICIENT_STOCK` |
| Reservar é tudo ou nada: faltando saldo para um item, a transação desfaz a reserva e as baixas anteriores | `INSUFFICIENT_STOCK` (`InsufficientStockError`), que a facade devolve como `{ ok: false }` |
| Uma reserva por referência (`UNIQUE ("referenceId")`) | — |
| Uma reserva é liberada uma vez só: `releasedAt` só é gravado se estiver vazio | — |
| A reserva e a liberação percorrem os itens em ordem de `productId` (`ReserveStockUseCase`, `ReleaseStockUseCase`) | — |

## Dependências

Nenhum módulo de negócio no `imports`.

## Schema e migrations

- Schema `inventory`, migrations registradas em `inventory_migrations`. Aplique com `npm run mig:inventory:run`.
- Migrations em `src/modules/inventory/infra/database/typeorm/migrations/`.

| Tabela | Conteúdo |
| --- | --- |
| `stock_items` | `productId` (chave), `available` (padrão 0, nunca negativo) |
| `reservations` | `id`, `referenceId` (único), `createdAt`, `releasedAt` |
| `reservation_items` | `reservationId` e `productId` (chave), `qty`. Apagada em cascata com a reserva |

## Seed

`npm run seed:inventory`: saldo de 50, 120 e 10 para os três produtos do seed do [catalog](catalog.md#seed), com os mesmos ids. Insere só o que falta e não restaura saldo já consumido.

## Decisões

- [ADR 0003](../../adr/0003-imports-explicitos-entre-modulos.md): o inventory exporta só a facade, e quem a usa importa o `InventoryModule`.
