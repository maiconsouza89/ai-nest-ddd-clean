# Plano do ciclo do pedido: rascunho editável, aviso de cancelamento e filtro por status

O orders já cria, lista, consulta, fecha, paga, cancela e expira pedidos ([Módulo orders](../reference/modules/orders.md)). Faltam três peças para o ciclo ficar completo do ponto de vista do cliente:

- **O rascunho não se edita.** O status `DRAFT` existe e o domínio aceita `addItem` nele, mas nenhuma rota muda os itens depois do `POST /v1/orders`. Para corrigir um item, o cliente precisa cancelar e criar outro pedido.
- **O cancelamento não avisa ninguém.** O notifications só reage ao `orders.order-paid`. Um pedido que expira pelo job some sem aviso ao cliente.
- **A listagem não filtra.** `GET /v1/orders` devolve todos os pedidos do cliente, e quem quer só os que esperam pagamento precisa paginar tudo.

Cada fase usa um how-to que já existe e ainda não foi seguido numa funcionalidade de verdade. Se um how-to não funcionar como está escrito, corrija-o na mesma fase.

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. As rotas mais usadas aqui: `docs/reference/modules/orders.md`, `docs/reference/camadas.md`, `docs/how-to/publicar-um-evento-de-integracao.md`, `docs/how-to/paginar-uma-listagem.md`, `docs/how-to/cachear-uma-leitura.md` e `docs/reference/testes.md`.
- Uma fase só termina com `npm run ci`, `npm run test:int` e `npm run test:e2e` passando, e depois de `/simplify` e `/code-review` sobre as mudanças dela (fluxo de entrega do `CLAUDE.md`).
- Toda mudança de comportamento atualiza a página do módulo afetado em `docs/reference/modules/` e, se surgir termo novo, o `docs/reference/glossario.md`.
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Quando todas as fases estiverem ✅, apague este arquivo e tire o link dele do `docs/README.md`. O registro fica no histórico do git.

## Mapa

| Fase | O que entrega | Status |
| --- | --- | --- |
| 1. Rascunho editável | Acrescentar, mudar a quantidade e remover itens de um pedido em `DRAFT` | ⬜ |
| 2. Aviso de cancelamento | `orders.order-cancelled` v2 com o motivo, e e-mail ao cliente pelo notifications | ⬜ |
| 3. Filtro por status | `GET /v1/orders?status=…`, com o cache e o índice certos | ⬜ |

As fases são independentes. A ordem acima vai da que mexe mais no domínio para a que mexe menos.

---

## Fase 1: rascunho editável

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: regras de edição no agregado
> - [ ] Passo 2: casos de uso e evento de itens alterados
> - [ ] Passo 3: rotas HTTP e documentação

### Passo 1: regras de edição no agregado

**Por quê:** a regra "itens só mudam em `DRAFT`" já vive no `Order` (`addItem` lança `ORDER_NOT_EDITABLE`). Mudar e remover itens são a mesma regra, e ficam no mesmo lugar. O limite de 100 itens hoje só existe no DTO do `POST /v1/orders`. Com uma rota de acrescentar item, o DTO deixa de bastar, e o limite vira invariante do agregado.

**Faça:**

- No `Order`: `changeItemQty(productId, qty)`, que troca a quantidade (não soma), e `removeItem(productId)`. Os dois só em `DRAFT`. Item inexistente lança um erro novo, `ORDER_ITEM_NOT_FOUND`.
- No `OrderItem`: um método que troca a quantidade, com a mesma validação do construtor (`INVALID_QUANTITY`).
- Limite de itens distintos no agregado: `addItem` de um produto novo num pedido com 100 itens lança `TOO_MANY_ITEMS` (422). O DTO do `POST` continua limitando a 100, para recusar cedo.
- Remover o último item é permitido. O `place()` já recusa pedido vazio com `EMPTY_ORDER`.
- Os métodos não anotam evento de domínio ainda: o passo 2 decide qual.

**Pronto quando:** os testes de unidade do `Order` cobrem cada método em `DRAFT` e fora dele, item inexistente, quantidade inválida, o limite de 100 e a remoção do último item. `npm test -- order.entity` passa.

### Passo 2: casos de uso e evento de itens alterados

**Por quê:** a listagem passa pelo cache, invalidado pelos eventos do pedido. Uma edição sem evento deixaria `itemCount` e `totalCents` velhos na listagem por até 60 segundos, e o cache é trocado de geração só por evento ([Cache da listagem](../reference/modules/orders.md#jobs-e-cache)). Um evento de integração `orders.order-items-changed` mantém o padrão: o próprio orders o consome para invalidar, como faz com os outros quatro.

**Faça:**

- Casos de uso `AddOrderItemUseCase`, `ChangeOrderItemQtyUseCase` e `RemoveOrderItemUseCase`, com a mesma regra de acesso dos outros (dono ou `admin`, pelo `order-access.ts`), a mesma transação e a mesma concorrência otimista do `PlaceOrderUseCase`.
- O `AddOrderItemUseCase` busca o preço pelo `PriceCatalog`, como o `CreateOrderUseCase`. Produto inexistente: `PRODUCT_NOT_FOUND`. Se o produto já está no pedido, a quantidade soma e o preço unitário fica o já gravado. Registre essa regra no módulo.
- Evento de domínio `OrderItemsChanged` anotado pelos três métodos do passo 1 (e pelo `addItem`, quando chamado fora do `create`). Ele vira `orders.order-items-changed` v1, com `orderId` e `customerId`, seguindo `docs/how-to/publicar-um-evento-de-integracao.md`: contrato, exemplo versionado, teste de contrato e o tipo na lista do `InvalidateOrderListCacheHandler`.
- Cuidado: o `create` usa `addItem` e não deve anotar `OrderItemsChanged`, porque o `OrderCreated` já invalida. Resolva no agregado, não no caso de uso.
- Efeito colateral a registrar: editar o rascunho grava a linha do pedido, que avança o `updatedAt` e reinicia o prazo da expiração. Confirme com um teste de integração e descreva no módulo.

**Pronto quando:** testes de unidade dos três casos de uso (dono, admin, outro ator, pedido inexistente, conflito de versão), o teste de contrato do evento novo e um teste de integração em que remover um item apaga a linha de `order_items` (o `orphanedRowAction: 'delete'` da ORM entity) e mudar a quantidade atualiza a linha existente.

### Passo 3: rotas HTTP e documentação

**Por quê:** o recurso é o item dentro do pedido, identificado pelo produto, porque o mesmo produto aparece uma vez só no pedido.

**Faça:**

| Rota | Corpo | Sucesso |
| --- | --- | --- |
| `POST /v1/orders/:id/items` | `{ productId, qty }`, `qty` inteiro ≥ 1 | 204 |
| `PATCH /v1/orders/:id/items/:productId` | `{ qty }`, `qty` inteiro ≥ 1 | 204 |
| `DELETE /v1/orders/:id/items/:productId` | — | 204 |

- `ParseUUIDPipe` no `:id`, como nas rotas existentes. O `productId` segue o formato que o catalog usa.
- Os erros novos no `OrdersDomainErrorFilter`: `ORDER_ITEM_NOT_FOUND` 404, `TOO_MANY_ITEMS` 422.
- E2E: o fluxo criar → acrescentar → mudar → remover → fechar, a listagem mostrando o total novo logo depois da edição (prova a invalidação), e as recusas em `PLACED` e por outro ator.
- Documentação: `docs/reference/modules/orders.md` (linguagem ubíqua, rotas, tabela de erros, invariantes, eventos publicados e consumidos, o prazo de expiração reiniciado). O tutorial `docs/tutorials/01-do-clone-ao-primeiro-pedido.md` só muda se o fluxo dele mudar.

**Pronto quando:** `npm run test:e2e -- orders` passa com os casos novos, o Swagger em `/docs` mostra as três rotas, e o `docs:check` passa.

---

## Fase 2: aviso de cancelamento

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 4: `orders.order-cancelled` v2 com o motivo
> - [ ] Passo 5: e-mail de cancelamento no notifications

### Passo 4: `orders.order-cancelled` v2 com o motivo

**Por quê:** o e-mail de "você cancelou o pedido" e o de "o pedido expirou sem pagamento" dizem coisas diferentes, e o payload v1 (`orderId`, `customerId`) não diz qual foi. Acrescentar o motivo muda o contrato. É a primeira vez que um contrato do projeto muda de versão, e a regra está em [Contratos são API pública e têm versão](../explanation/comunicacao-entre-modulos.md#contratos-são-api-pública-e-têm-versão): um evento v1 parado na outbox ou na fila antes do deploy é consumido pelo código novo.

**Faça:**

- `OrderCancelled` de domínio ganha `reason: 'requested' | 'expired'`. O `cancel()` recebe o motivo. O `CancelOrderUseCase` passa `requested` e o `ExpirePendingOrdersUseCase` passa `expired`.
- Contrato `OrderCancelledV2` e exemplo `order-cancelled.v2.example.ts`. O orders passa a publicar só a v2.
- O consumidor do inventory e o `InvalidateOrderListCacheHandler` aceitam a v1 e a v2: os campos que eles usam são os mesmos. O teste de contrato de cada consumidor roda contra os dois exemplos.
- Decida e registre no passo quando a v1 sai do código dos consumidores (por exemplo, no deploy seguinte, depois de a outbox e as filas esvaziarem). Mantenha o exemplo v1 até lá.
- Se a mudança de versão revelar algo que o how-to de evento não cobre, acrescente uma seção "Mudar a versão de um evento" ao `docs/how-to/publicar-um-evento-de-integracao.md`.

**Pronto quando:** os testes de contrato dos dois lados passam com a v1 e a v2, o `npm run test:int -- expire-pending-orders` confere o `reason: 'expired'` na outbox, e `docs/reference/modules/orders.md` e `docs/reference/modules/inventory.md` mostram as duas versões.

### Passo 5: e-mail de cancelamento no notifications

**Por quê:** é o segundo consumidor do notifications e repete o desenho do `OnOrderPaidHandler`. Um segundo caso é o que mostra se o desenho do primeiro se generaliza ou se pede uma abstração.

**Faça:**

- `SendOrderCancelledEmailUseCase` em `application/use-cases/`, com o assunto e o corpo pelo motivo: "Pedido cancelado: pedido `<orderId>`" para `requested` e "Pedido expirado: pedido `<orderId>`" para `expired`. Cliente sem usuário segue a regra do e-mail de pagamento: aviso no log, sem erro.
- `OnOrderCancelledHandler` com o consumidor `notifications.email-on-order-cancelled`, pelo `IdempotentConsumer`, importando só os tipos do contrato. Ele aceita a v1 (sem motivo, texto genérico) e a v2.
- Não extraia uma base comum com o handler de pagamento se a duplicação for só a estrutura. Registre a decisão no "Como ficou".

**Pronto quando:** testes de unidade do caso de uso (os dois motivos, a v1 e o cliente apagado), o teste de contrato do handler contra os exemplos do orders, e um E2E ou integração em que cancelar um pedido produz o log do envio. `docs/reference/modules/notifications.md` e a coluna "Consumido por" do orders atualizadas.

---

## Fase 3: filtro por status

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 6: `status` na listagem

### Passo 6: `status` na listagem

**Por quê:** o filtro muda três coisas que têm regra própria no projeto: a query paginada (o desempate estável), a chave do cache (uma página filtrada não pode servir uma consulta sem filtro) e o índice.

**Faça:**

- Query `status` opcional em `GET /v1/orders`, um dos valores de `OrderStatus`. Valor fora da lista: 400. Siga `docs/how-to/paginar-uma-listagem.md`: um DTO de query que estende o `PaginationQuery`, e o filtro na query, nunca depois de carregar.
- `OrderQueries.listByCustomer` recebe o filtro. O `total` conta com o mesmo filtro.
- `CachedOrderQueries`: o status entra na chave da página. A geração continua uma por cliente, então um evento invalida as listagens com e sem filtro juntas. Siga `docs/how-to/cachear-uma-leitura.md`.
- Índice: confira o plano da query com `EXPLAIN` num banco com volume (o seed ou um script descartável). Se o Postgres não usar índice para `customerId` com `status` ordenado por `createdAt`, crie um índice `(customerId, status, createdAt DESC, id DESC)` pela ORM entity e gere a migration com `docs/how-to/gerar-uma-migration.md`. Registre o `EXPLAIN` antes e depois no "Como ficou".

**Pronto quando:** teste de integração da query com e sem filtro (itens, `total` e desempate), teste do cache em que a página filtrada e a sem filtro não se misturam e ambas mudam depois de um evento, e E2E com um status válido e um inválido. `docs/reference/modules/orders.md` mostra a query nova.

---

## Validação da entrega

- [ ] `npm run ci`, `npm run test:int` e `npm run test:e2e` passam ao fim de cada fase.
- [ ] `/simplify` e `/code-review` rodados ao fim de cada fase, com o resultado no "Como ficou" do último passo dela.
- [ ] `npm run arch` sem violação nova: o notifications continua importando só tipos do contrato do orders.
- [ ] As páginas dos módulos orders, inventory e notifications descrevem o comportamento final, e o glossário tem os termos novos (por exemplo, "Motivo do cancelamento").
- [ ] Os how-tos usados foram seguidos como estão escritos, ou corrigidos onde não funcionaram.
