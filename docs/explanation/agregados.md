---
type: explanation
---

# Agregados

Por que o item do pedido faz parte do agregado `Order`, por que o estoque é outro módulo e como o orders reserva estoque sem conhecer o inventory. O que cada módulo expõe está nas páginas do [orders](../reference/modules/orders.md) e do [inventory](../reference/modules/inventory.md).

## Contexto

Fechar um pedido envolve três coisas: os itens do pedido, o total e o saldo de estoque de cada produto. Todas parecem "do pedido", mas mudam por motivos diferentes. Os itens só mudam enquanto o pedido é rascunho, e o total sai deles. O saldo é um só para todos os pedidos de todos os clientes, e muda quando qualquer um deles fecha ou é cancelado.

A pergunta é onde fica a fronteira: o que é salvo junto, numa transação, com uma regra garantida pela raiz, e o que vive à parte e é consultado ou avisado.

## Por quê

### O que fica no agregado

Um objeto fica no agregado quando muda junto com o pai e as regras dele dependem do pai. Um objeto com regras próprias, que vive sozinho, é outro agregado, e muitas vezes outro módulo.

- **`OrderItem` fica no `Order`:** o total soma os itens, e um item não pode ser incluído nem alterado depois que o pedido fecha. Essas regras só se garantem se toda mudança nos itens passar pela raiz.
- **Estoque fica no inventory:** o saldo de um produto é disputado por todos os pedidos, tem regras próprias (nunca negativo, uma reserva por referência, liberação uma vez só) e é devolvido por uma transação do próprio inventory quando um pedido é cancelado.

As regras de agregado do Vaughn Vernon resumem o critério:

- proteja as invariantes dentro do agregado;
- mantenha os agregados pequenos;
- referencie outro agregado só pelo id;
- altere um agregado por transação, e use consistência eventual entre agregados.

### Order e OrderItem: a raiz controla a lista

```ts
// order.entity.ts
get items(): readonly OrderItem[] {
  return [...this._items];
}

get total() {
  return this._items.reduce((sum, i) => sum.add(i.subtotal), Money.zero());
}

addItem(productId: string, qty: number, unitPrice: Money) {
  if (this._status !== OrderStatus.DRAFT) throw new OrderNotEditableError();
  const existing = this._items.find((i) => i.productId === productId);
  if (existing) existing.increase(qty);
  else this._items.push(new OrderItem(productId, qty, unitPrice));
}
```

O getter `items` devolve uma cópia readonly, e só a raiz mexe na lista interna. Quem quer um item novo chama `addItem`, que confere o status. Daí saem três consequências:

- **Não existe `OrderItemRepository`.** O `OrderRepository` salva o pedido e os itens juntos, na mesma transação. Um repositório de item permitiria gravar um item sem passar pela regra do status.
- **A ORM entity espelha o agregado:** `@OneToMany` com `cascade: true` no pedido, chave composta (`orderId`, `productId`) e `orphanedRowAction: 'delete'` no item. O mapper converte os dois lados ([Persistência](persistencia.md)).
- **O item guarda só o `productId` e uma cópia do preço.** O produto é de outro módulo e é referenciado pelo id. O preço é copiado do catalog quando o pedido é criado. Se o catalog mudar o preço depois, o pedido continua com o preço da compra.

### O estoque entra por um port do orders

O orders declara o que precisa num port, com as palavras dele. O adapter, na infra do orders, chama a facade do inventory:

```ts
// orders/application/ports/stock-gateway.ts
export abstract class StockGateway {
  abstract reserve(orderId: string, items: { productId: string; qty: number }[]): Promise<void>;
}

// orders/infra/gateways/inventory-stock.gateway.ts
// Traduz o contrato do inventory (resultado) para o port do orders (erro de domínio).
export class InventoryStockGateway implements StockGateway {
  constructor(private readonly inventory: InventoryFacade) {}

  async reserve(orderId: string, items: { productId: string; qty: number }[]) {
    const result = await this.inventory.reserve({ referenceId: orderId, items });
    if (!result.ok) throw new InsufficientStockError(result.productId);
  }
}
```

O caso de uso conhece só o `StockGateway` e o `InsufficientStockError` do orders. O formato do contrato do inventory (`{ ok, reason, productId }`) fica no adapter. Se o inventory virar um serviço à parte, chamado por HTTP, só o adapter muda.

O `orderId` vai como `referenceId` da reserva. Se a chamada se repetir por retry ou timeout, o inventory reconhece a referência e não reserva de novo.

### Síncrono, dentro da transação do pedido

O `PlaceOrderUseCase` reserva antes de fechar, dentro da própria transação:

```ts
await this.tx.run(async () => {
  const order = await loadOwnedOrder(this.repo, orderId, actor);
  // reserva antes de fechar: se faltar estoque, o pedido continua como estava
  await this.stock.reserve(
    order.id,
    order.items.map((i) => ({ productId: i.productId, qty: i.qty })),
  );
  order.place();
  await this.repo.save(order);
  await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
});
```

O `ReserveStockUseCase` do inventory também roda em `tx.run`, e o `TransactionManager` reaproveita a transação ativa em vez de abrir outra. Os dois módulos usam a mesma conexão, então a reserva entra na transação do pedido. Se o `save` falhar, por exemplo num conflito de concorrência, a reserva é desfeita junto, e não sobra estoque reservado para um pedido que não fechou.

Isso tem um preço. É a única transação que grava no schema de dois módulos, contra a regra "sem transação entre módulos" ([Comunicação entre módulos](comunicacao-entre-modulos.md#cada-módulo-tem-schema-e-migrations-próprios)) e contra o "um agregado por transação". As linhas de saldo baixadas ficam travadas até o pedido confirmar. E a garantia depende da conexão compartilhada: com uma conexão por módulo, ou com o inventory num serviço à parte, a reserva confirma sozinha, e um `save` que falha depois deixa estoque reservado sem pedido. Aí é preciso compensar, liberando a reserva, ou passar para eventos.

| Abordagem | Como funciona | Prós | Contras |
| --- | --- | --- | --- |
| Síncrona (implementada) | O caso de uso reserva pelo port e depois fecha e salva o pedido, na mesma transação | Simples, resposta imediata, sem reserva órfã enquanto a conexão é compartilhada | Acopla a transação dos dois módulos e trava o saldo durante o fechamento. Separada a conexão, precisa de compensação |
| Por eventos (não implementada) | O pedido salvo num estado de espera publica `OrderPlaced`, o inventory responde com reserva feita ou recusada, e o pedido confirma ou cancela | Módulos desacoplados, cada transação num módulo só | Consistência eventual, um estado a mais no pedido e mais peças (outbox, handlers, timeout da espera) |

O síncrono serve enquanto os módulos rodam no mesmo processo e no mesmo banco. A troca para eventos se paga quando o inventory precisar de conexão própria, virar um serviço, ou quando a trava do saldo durante o fechamento virar gargalo. Ela mexe mais do que o adapter: o `Order` ganha o estado de espera, o fechamento passa a terminar num handler da resposta do inventory, e o `StockGateway` deixa de ser chamado no `PlaceOrderUseCase`.

## Alternativas e trade-offs

- **`OrderItem` como agregado próprio, com repositório:** permitiria alterar um item sem carregar o pedido. Em troca, o total e a regra "não editar depois de fechar" deixariam de ter um dono, e cada caso de uso que mexe em item teria de repeti-las.
- **Estoque dentro do `Order`:** a reserva e o fechamento seriam uma regra só, num agregado só. Mas o saldo é compartilhado: o agregado teria de incluir o saldo de cada produto do pedido, e dois pedidos do mesmo produto, de clientes diferentes, entrariam em conflito ao fechar.
- **Caso de uso chamando a `InventoryFacade` direto, sem port:** o `npm run arch` permite, porque é um import de `contracts/`. Mas a application do orders passaria a tratar o resultado do inventory e a depender do nome e do formato do contrato dele, e levar o inventory para um serviço à parte mexeria no caso de uso.
- **Reserva por eventos desde o início:** desacopla as transações, mas cobra o estado de espera e o tratamento de recusa e de timeout antes de o sistema precisar disso.

## Decisões relacionadas

- [ADR 0003: Imports explícitos entre módulos, sem `@Global`](../adr/0003-imports-explicitos-entre-modulos.md): o `OrdersModule` importa o `InventoryModule` para receber a `InventoryFacade`.
