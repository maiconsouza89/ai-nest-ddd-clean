---
type: explanation
---

# Transações e concorrência

Como um caso de uso grava tudo numa transação sem conhecer o TypeORM, o que acontece quando duas requisições mexem no mesmo pedido ou no mesmo saldo, e como o pagamento aguenta o reenvio do cliente. O que acontece com os eventos gravados nessa transação está em [Entrega de eventos](entrega-de-eventos.md).

## Contexto

Pagar um pedido parece uma coisa só: carregar o pedido, mudar o status, salvar e gravar o evento. Mas o caso de uso precisa resolver quatro problemas:

- **As gravações entram juntas.** O pedido, a chave de idempotência e o evento precisam ser gravados juntos ou não ser gravados. A application, porém, não pode conhecer o TypeORM.
- **Requisições ao mesmo tempo.** Um pagamento e um cancelamento do mesmo pedido podem carregar o mesmo estado e gravar um por cima do outro.
- **Um efeito que não se desfaz.** A cobrança no fornecedor acontece fora do banco, e um rollback não a devolve.
- **O cliente reenvia.** Um timeout não diz ao cliente se o pagamento foi feito, e ele tenta de novo.

O estoque tem um problema parecido com outra forma: o saldo de um produto é disputado por todos os pedidos ao mesmo tempo.

## Por quê

### A transação vai pelo contexto, e não pelos parâmetros

A application declara o port e a infra o implementa com o `AsyncLocalStorage` do Node, que guarda o `EntityManager` da transação aberta:

```ts
// shared/application/ports/transaction-manager.ts
export abstract class TransactionManager {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}

// shared/infra/database/transaction-context.ts: o txStore é privado do arquivo
const txStore = new AsyncLocalStorage<EntityManager>();
export function currentManager(dataSource: DataSource): EntityManager {
  return txStore.getStore() ?? dataSource.manager;
}

// shared/infra/database/typeorm-transaction-manager.ts: uma transação já aberta é reaproveitada
run<T>(work: () => Promise<T>): Promise<T> {
  if (hasActiveTransaction()) return work();
  return this.dataSource.transaction((em) => runWithManager(em, work));
}
```

O caso de uso chama `tx.run` e não passa a transação adiante. Cada repositório, a outbox e o registro de eventos processados pegam o manager da transação ativa com `currentManager` ([Persistência](persistencia.md#o-repositório-grava-na-transação-do-caso-de-uso)). Um repositório chamado fora de `tx.run` usa o manager padrão do DataSource.

Reaproveitar a transação aberta permite que um `tx.run` chame código que também abre o seu. O `IdempotentConsumer` abre uma transação e chama um caso de uso que abre outra, e a reserva de estoque roda dentro da transação do fechamento do pedido ([Agregados](agregados.md#síncrono-dentro-da-transação-do-pedido)). Nos dois casos, tudo vira uma transação só.

A regra é alterar um agregado por transação. A outbox, a marca de evento processado e a chave de idempotência gravam junto, porque não são agregados: são o registro técnico de que a mudança aconteceu. A única exceção de negócio é a reserva de estoque, que tem a página dela.

### Concorrência otimista no save

O `Order` carrega a versão lida do banco, e o `save` só avança se ela não mudou:

```ts
// typeorm-order.repository.ts
async save(order: Order) {
  const next = order.version + 1;
  if (order.version > 0) {
    // só avança se ninguém gravou desde que o pedido foi carregado
    const res = await this.repo.update({ id: order.id, version: order.version }, { version: next });
    if (res.affected === 0) throw new ConcurrencyError();
  }
  const row = OrderMapper.toPersistence(order);
  row.version = next;
  await this.repo.save(row);
}
```

Das duas requisições, a que grava por último não acha mais a versão que leu e falha com `CONCURRENCY_CONFLICT` (409). O cliente relê o pedido e decide de novo, agora sobre o estado real. O `update` com `WHERE version` é manual porque o `@VersionColumn` do TypeORM incrementa a versão, mas o `save()` dele não recusa quem gravou por cima. A trava é otimista porque o conflito é raro: ninguém espera, e só quem perde a corrida paga, com um retry.

O mesmo vale para todo agregado que pode ser editado em paralelo, e por isso o `plop module` já gera a entidade com `version` e o repositório com essa checagem ([Concorrência otimista](../reference/glossario.md#concorrência-otimista)).

O `save` trata `version === 0` como agregado novo e pula a checagem. Uma linha que já exista com versão 0, vinda de uma migração de dados com default 0, por exemplo, fica sem proteção no primeiro save. O que o `Order.create` cria não tem esse problema.

### Trava pessimista quando o efeito não se desfaz

O pagamento cobra no fornecedor antes de salvar. Com a trava otimista apenas, um cancelamento poderia confirmar entre a cobrança e o `save`. O pagamento falharia por conflito, mas o dinheiro já teria sido cobrado de um pedido cancelado.

Por isso o `PayOrderUseCase` carrega o pedido com `findByIdForUpdate` (`loadOwnedOrder(..., { lock: true })`), que faz um `SELECT ... FOR UPDATE` só na linha do pedido. O Postgres não aceita `FOR UPDATE` no lado opcional de um join, então os itens são carregados depois, sem trava. Um cancelamento ou uma expiração ao mesmo tempo lê o pedido sem trava e ainda o vê pendente. Ele só espera no `UPDATE ... WHERE version` do `save` e, depois do commit do pagamento, não acha mais a versão que leu: falha com `CONCURRENCY_CONFLICT` (409). Se ele só lê o pedido depois do commit, encontra o pedido pago e falha com `ORDER_NOT_CANCELLABLE`. Nos dois casos, um pedido cobrado não é cancelado. O preço é segurar a linha e a conexão durante a chamada ao fornecedor, e por isso o timeout e as tentativas da cobrança são curtos (cerca de 6 segundos no pior caso). A trava pessimista fica restrita a esse caso: um efeito externo que não volta atrás.

### Estoque: update condicional, sem ler antes

O saldo de um produto é disputado por todos os pedidos, e ler, conferir e gravar com versão faria os pedidos do mesmo produto se derrubarem. O banco faz a conta e a checagem numa instrução só:

```ts
// typeorm-stock.repository.ts: as colunas são camelCase, então vão entre aspas no SQL
async decrease(productId: string, qty: number) {
  const res = await this.manager
    .createQueryBuilder()
    .update(StockItemOrmEntity)
    .set({ available: () => '"available" - :qty' })
    .where('"productId" = :productId AND "available" >= :qty', { productId, qty })
    .execute();
  return res.affected === 1;
}

// reserve-stock.use-case.ts: quem decide o erro é a application
if (!(await this.stock.decrease(productId, qty))) throw new InsufficientStockError(productId);
```

Nenhuma linha afetada quer dizer saldo insuficiente. O `ReserveStockUseCase` percorre os itens sempre na ordem do `productId`, para que duas reservas com os mesmos produtos travem as linhas na mesma ordem e não entrem em deadlock.

### Idempotency-Key no pagamento

Do lado do cliente HTTP, o problema é o mesmo da entrega repetida de eventos ([Entrega de eventos](entrega-de-eventos.md#pelo-menos-uma-vez-efeito-uma-vez-só)): um timeout não diz se o pagamento foi feito. O cliente reenvia com o mesmo cabeçalho [`Idempotency-Key`](../reference/glossario.md#idempotency-key), descrito num draft da IETF que ainda não virou RFC. O contrato do cabeçalho, os erros e o prazo da chave estão em [orders](../reference/modules/orders.md).

O `PayOrderUseCase` reserva a chave dentro da transação do pagamento, por ator, com uma impressão digital da requisição (`pay:<orderId>`) e um prazo:

- **A reserva entra na transação.** A chave é gravada junto com o pedido e o evento. Se o pagamento falhar, a transação desfaz a chave, e ela não fica queimada para uma nova tentativa.
- **A resposta não é guardada.** Repetir a mesma chave para o mesmo pedido termina sem cobrar e responde igual à primeira vez. Isso basta porque o pagamento sempre responde sem corpo. Uma rota que devolve corpo teria de guardá-lo com a chave.
- **A impressão digital barra o reuso.** A mesma chave para outro pedido é recusada, em vez de responder como se o outro pedido tivesse sido pago.
- **A corrida se resolve no índice único.** Com duas requisições ao mesmo tempo, a segunda espera a primeira na chave primária da tabela. Se a primeira confirmar, a segunda cai no caso da mesma chave. Se for desfeita, a segunda reserva a chave e segue. Consultar antes se a chave existe não resolveria, porque as duas consultas podem responder "não" antes de qualquer uma gravar.
- **A chave vence.** Depois do prazo, a reserva reaproveita a linha vencida em vez de recusar, e a mesma chave volta a valer, mesmo para outro pedido.

O cabeçalho é opcional: sem ele, o pagamento roda sem reservar chave. O mesmo `pay:<orderId>` vai ao fornecedor como chave de idempotência da cobrança. Se o commit falhar depois da cobrança, o retry reenvia a mesma chave e o fornecedor não cobra de novo.

## Alternativas e trade-offs

- **Passar o `EntityManager` por parâmetro:** deixa explícito o que entra na transação. Em troca, todo port de repositório ganharia um parâmetro de transação, a application voltaria a conhecer o TypeORM (ou um tipo genérico que o imita), e um repositório chamado sem o parâmetro gravaria fora da transação, sem erro.
- **`@nestjs-cls/transactional` com o `@nestjs-cls/transactional-adapter-typeorm`:** o plugin faz a mesma propagação com `AsyncLocalStorage` e oferece o decorator `@Transactional()`. Usar o decorator no caso de uso poria o Nest na application, o que o `npm run arch` barra. O plugin pode entrar só na implementação do `TransactionManager`, com o port intacto. Ele traz um módulo a mais, e a implementação própria tem poucas linhas.
- **Só o `@VersionColumn` do TypeORM:** incrementa a versão, mas não recusa a gravação de quem leu uma versão antiga. Sem o `WHERE version`, a última gravação vence em silêncio.
- **Trava pessimista em todo caso de uso:** mais fácil de entender, mas cada requisição seguraria a linha e a conexão até o commit, e as esperas e os deadlocks crescem com o tráfego. O projeto a usa só onde há um efeito externo que não se desfaz.
- **Ler o saldo, conferir e gravar com versão:** o mesmo padrão do pedido. Mas o saldo é disputado por todos os pedidos do produto, e cada conflito viraria um retry. O update condicional não tem conflito a repetir: ou o saldo basta, ou não.
- **Guardar a resposta junto com a `Idempotency-Key`:** é o que uma rota com corpo precisaria. No pagamento, sem corpo, seria uma coluna sem uso.

## Decisões relacionadas

Nenhum ADR trata deste desenho: o porquê está nesta página.
