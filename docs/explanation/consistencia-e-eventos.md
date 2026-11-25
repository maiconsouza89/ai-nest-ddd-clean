---
type: explanation
---

# Consistência e eventos

Como um caso de uso grava tudo numa transação sem conhecer o TypeORM, o que acontece quando duas requisições mexem no mesmo pedido e por que um evento só sai depois que o agregado é salvo e pode chegar mais de uma vez. O passo a passo para criar um evento está em [Como publicar um evento de integração](../how-to/publicar-um-evento-de-integracao.md), e os eventos de cada módulo estão na página dele (por exemplo, [orders](../reference/modules/orders.md#eventos-publicados)).

## Contexto

Pagar um pedido parece uma coisa só: carregar o pedido, mudar o status, salvar e avisar os outros módulos (o notifications manda o e-mail, o cache da listagem é descartado). Mas o caso de uso precisa resolver quatro problemas:

- **As gravações entram juntas.** O pedido, a chave de idempotência e o evento precisam ser gravados juntos ou não ser gravados. A application, porém, não pode conhecer o TypeORM.
- **Requisições ao mesmo tempo.** Um pagamento e um cancelamento do mesmo pedido podem carregar o mesmo estado e gravar um por cima do outro.
- **O aviso não pode mentir nem se perder.** Avisar antes de salvar anuncia algo que pode não ter acontecido. Avisar depois pode não acontecer se o processo cair no meio.
- **O aviso pode chegar duas vezes.** Toda entrega com nova tentativa pode repetir, e o consumidor precisa produzir o efeito uma vez só.

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

### O evento sai pela outbox

A entidade anota o fato e não publica:

```ts
// shared/domain/aggregate-root.ts
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];
  protected addDomainEvent(event: DomainEvent) {
    this.domainEvents.push(event);
  }
  pullDomainEvents() {
    const pulled = this.domainEvents;
    this.domainEvents = [];
    return pulled;
  }
}
```

O caso de uso salva o agregado e, na mesma transação, converte os eventos de domínio no contrato público e os grava na tabela `shared.outbox`:

```ts
await this.tx.run(async () => {
  await this.repo.save(order);
  await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
});
```

Se o `save` falhar, o evento também não é gravado, e se a transação confirmar, o evento está no banco esperando a entrega. Assim, nada é salvo sem gerar o evento e nenhum evento sai sem o `save`. A conversão (`toIntegrationEvent`) separa o fato interno do contrato: o evento de domínio é uma classe do domain, e o de integração tem `eventId`, `version`, data em ISO e um payload só com primitivos ([Comunicação entre módulos](comunicacao-entre-modulos.md#contratos-são-api-pública-e-têm-versão)). Um evento de domínio sem contrato faz a conversão lançar um erro, e o `save` é desfeito.

Com [`OUTBOX_WORKER_ENABLED`](../reference/variaveis-de-ambiente.md#workers-e-jobs) ligado, um relay lê a outbox em lotes de 50 (`DEFAULT_OUTBOX_OPTIONS`, no `outbox-relay.ts`) e entrega cada evento. O worker (`outbox-worker.ts`) só espera 1 s antes da próxima busca quando o lote vem incompleto. Com um lote cheio, busca de novo na hora. A busca usa SQL escrito à mão:

- **`FOR UPDATE OF o SKIP LOCKED`:** dois processos com o worker ligado nunca pegam a mesma linha. O `.setLock('pessimistic_write').setOnLocked('skip_locked')` do query builder não serve aqui, porque a busca tem uma subquery e o Postgres recusa travar o lado anulável de um outer join. O `OF o` trava só as linhas da outbox.
- **Ordem por agregado:** um `NOT EXISTS` deixa de fora um evento enquanto houver um anterior do mesmo agregado ainda por entregar, inclusive um que esteja esperando nova tentativa.
- **Falhas:** cada falha registra o erro e adia a próxima tentativa com backoff exponencial: 1 s depois da primeira falha, dobrando a cada falha até o teto de 5 min. Na oitava falha, a linha ganha `deadAt` e sai da busca. Daí em diante ela não segura mais os eventos seguintes do mesmo agregado, que saem sem ela. O `outbox.events` conta os pendentes e os mortos, e o `outbox.oldest_pending.age` mostra quando a outbox atrasa ([Observabilidade](observabilidade.md#métricas)).
- **Limpeza:** de hora em hora, o worker apaga os eventos publicados há mais de 7 dias (`CLEANUP_INTERVAL_MS`, no `outbox-worker.ts`, e `retentionMs`, no `outbox-relay.ts`). As linhas mortas da outbox (`deadAt`) ficam de propósito, para inspeção manual. Nada apaga essas linhas, nem as de `shared.processed_events` e de `orders.idempotency_keys`, e as três tabelas crescem sem limite ([Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados)).

### Uma fila por consumidor

O relay não chama os handlers. Ele enfileira o evento no BullMQ, numa fila por consumidor (`events.<consumidor>`), e marca a linha como publicada:

```text
caso de uso ─tx─▶ outbox (Postgres) ─relay─▶ fila por consumidor (Redis) ─▶ handler
```

Chamar os handlers no relay os poria dentro da transação que trava o lote: um handler lento seguraria o lote inteiro, e a falha de um consumidor faria o evento voltar para todos. Com uma fila para cada um, cada consumidor tem as suas tentativas e a sua fila de mortos, e os workers podem rodar num processo separado da API (`QUEUE_WORKERS_ENABLED`).

- **A outbox continua.** O Redis não participa da transação do Postgres. Enfileirar direto no caso de uso traria de volta o problema que a outbox resolve.
- **Fan-out pelo publicador.** No BullMQ, cada job vai para um worker só. O `BullMqPublisher` consulta quais consumidores assinam o tipo do evento e enfileira uma cópia para cada um. As assinaturas saem do `@IntegrationEventHandler` de cada handler, lido na subida pelo `DiscoveryService` do Nest, e cada módulo declara só os próprios handlers. Um evento sem assinante é aceito sem enfileirar nada.
- **Job repetido é ignorado.** O `jobId` é `<eventId>__<consumidor>` (o BullMQ não aceita `:` no id), e um job com id existente é ignorado. Se o relay cair entre enfileirar e marcar a linha, a repetição não duplica o job. Isso só vale enquanto o job existir, e por isso `removeOnComplete` usa uma idade, e não `true`.
- **Tentativas e retenção dos jobs** (`QUEUE_JOB_OPTIONS`, no `bullmq-publisher.ts`): 10 tentativas, com espera exponencial a partir de 2 s (2 s, 4 s, 8 s...), cerca de 17 min no total até o job ir para `failed`. Os jobs concluídos ficam guardados por 24 h, e os que falharam, por 7 dias. As 24 h são a janela em que o `jobId` impede o job duplicado. Depois dela, quem barra a repetição é o `processed_events` do consumidor.
- **Uma fila com problema não esconde as outras.** O publicador usa `Promise.allSettled`: tenta todas as filas e, se alguma falhar, o relay registra a falha e repete o evento depois. As filas que já tinham o job ignoram a repetição pelo `jobId`.
- **Duas filas de mortos.** Um job que esgota as tentativas fica no conjunto `failed` da fila do consumidor. O `deadAt` da outbox passa a valer só para o evento que não conseguiu ser enfileirado, com o Redis fora do ar, por exemplo. O `bullmq.queue.jobs` em `failed` conta os mortos de cada fila, o `bullmq.jobs.failed` conta os jobs que esgotaram as tentativas, e o `outbox.events` em `dead`, os mortos da outbox ([Observabilidade](observabilidade.md#métricas)).
- **A ordem vale até a fila.** Dentro dela, um retry com backoff pode inverter dois eventos do mesmo agregado, então nenhum consumidor pode depender da sequência. Os do projeto não dependem: pago e cancelado são estados que se excluem.
- **O trace atravessa a fila.** O handler aparece no mesmo trace da requisição que originou o evento ([Observabilidade](observabilidade.md#o-trace-atravessa-a-outbox-e-as-filas)).

### Pelo menos uma vez, efeito uma vez só

A entrega é "pelo menos uma vez": um evento pode chegar de novo quando o job falha depois de produzir parte do efeito e é tentado outra vez, ou quando o worker cai antes de confirmar o job. O [`IdempotentConsumer`](../reference/glossario.md#consumidor-idempotente) faz o handler produzir o efeito uma vez só:

```ts
// shared/application/idempotent-consumer.ts (sem o log)
handle<E extends IntegrationEvent>(consumer: string, event: E, work: (event: E) => Promise<void>) {
  return this.tx.run(async () => {
    // shared.processed_events tem chave primária ("eventId", "consumer")
    if (!(await this.processed.tryMark(event.eventId, consumer))) return; // já processado
    await work(event); // mesma transação: se o efeito falhar, a marca é desfeita
  });
}
```

O `tryMark` é um `INSERT ... ON CONFLICT DO NOTHING`, e só a primeira entrega consegue inserir. A chave primária resolve a corrida entre duas entregas simultâneas. Consultar antes se o evento já foi processado não resolve, porque as duas consultas podem responder "não" antes de qualquer uma gravar.

A garantia cobre o que o efeito grava no Postgres. Um efeito fora do banco, como o envio de e-mail do [notifications](../reference/modules/notifications.md#eventos-consumidos), pode se repetir se o processo cair entre o envio e o commit. Um efeito que pode se repetir sem dano, como trocar a geração do cache da listagem, dispensa a marca.

### Idempotency-Key no pagamento

Do lado do cliente HTTP, o problema é o mesmo: um timeout não diz se o pagamento foi feito. O cliente reenvia com o mesmo cabeçalho [`Idempotency-Key`](../reference/glossario.md#idempotency-key), descrito num draft da IETF que ainda não virou RFC.

O `PayOrderUseCase` reserva a chave dentro da transação do pagamento, por ator, com uma impressão digital da requisição (`pay:<orderId>`) e um prazo:

- **Primeira vez:** a chave é gravada junto com o pedido e o evento. Se o pagamento falhar, a transação desfaz a chave, e ela não fica queimada.
- **Mesma chave, mesmo pedido:** a requisição termina sem cobrar e responde 204 de novo. A resposta não precisa ser guardada, porque o pagamento sempre responde 204 sem corpo. Uma rota que devolve corpo teria de guardá-lo com a chave.
- **Mesma chave, outro pedido:** `IDEMPOTENCY_KEY_REUSED` (422).
- **Duas requisições ao mesmo tempo:** a segunda espera a primeira no índice único. Se a primeira confirmar, a segunda cai no caso da mesma chave. Se for desfeita, a segunda reserva a chave e segue.
- **Chave vencida:** o prazo é de 24 h (`IDEMPOTENCY_KEY_TTL_MS`, no `orders.module.ts`). Depois dele, a mesma chave pode ser usada de novo, mesmo para outro pedido: o `claim` do `typeorm-idempotency.store.ts` reaproveita a linha vencida em vez de recusar.

O cabeçalho é opcional: sem ele, o pagamento roda sem reservar chave. Uma chave vazia ou com mais de 255 caracteres responde `INVALID_IDEMPOTENCY_KEY` (400) antes de abrir a transação (`pay-order.use-case.ts`). As chaves ficam em `orders.idempotency_keys`, com chave primária (`actorId`, `key`).

O mesmo `pay:<orderId>` vai ao fornecedor como chave de idempotência da cobrança. Se o commit falhar depois da cobrança, o retry reenvia a mesma chave e o fornecedor não cobra de novo.

### Leitura sem agregado (CQRS leve)

As gravações passam pelo agregado e pelo repositório, porque é ali que ficam as invariantes, a versão e os eventos. A leitura não muda estado e não precisa de nada disso. A `OrderQueries` vai direto ao banco com query builder e devolve um DTO no formato da tela, com a paginação e o filtro pelo ator ([Camadas](../reference/camadas.md#application)).

Separar as duas abre espaço para o cache da listagem, que envolve a query e é descartado por um consumidor dos eventos do pedido. É só uma separação no código: a leitura vem do mesmo banco e da mesma tabela, e por isso enxerga a gravação assim que ela confirma.

## Alternativas e trade-offs

- **Passar o `EntityManager` por parâmetro:** deixa explícito o que entra na transação. Em troca, todo port de repositório ganharia um parâmetro de transação, a application voltaria a conhecer o TypeORM (ou um tipo genérico que o imita), e um repositório chamado sem o parâmetro gravaria fora da transação, sem erro.
- **`@nestjs-cls/transactional` com o `@nestjs-cls/transactional-adapter-typeorm`:** o plugin faz a mesma propagação com `AsyncLocalStorage` e oferece o decorator `@Transactional()`. Usar o decorator no caso de uso poria o Nest na application, o que o `npm run arch` barra. O plugin pode entrar só na implementação do `TransactionManager`, com o port intacto. Ele traz um módulo a mais, e a implementação própria tem poucas linhas.
- **Só o `@VersionColumn` do TypeORM:** incrementa a versão, mas não recusa a gravação de quem leu uma versão antiga. Sem o `WHERE version`, a última gravação vence em silêncio.
- **Trava pessimista em todo caso de uso:** mais fácil de entender, mas cada requisição seguraria a linha e a conexão até o commit, e as esperas e os deadlocks crescem com o tráfego. O projeto a usa só onde há um efeito externo que não se desfaz.
- **Publicar direto, depois do commit:** sem outbox nem relay. Mas se o processo cair entre o commit e a publicação, o evento se perde, e publicar antes do commit anuncia algo que pode ser desfeito.
- **Enfileirar no BullMQ dentro do caso de uso:** tira a outbox do caminho, mas o Redis não entra na transação do Postgres, e voltam os mesmos dois problemas.
- **Barramento em memória chamado pelo relay:** dispensa o Redis, mas o handler roda dentro da transação do lote, um handler lento segura todos e a falha de um devolve o evento a todos. O projeto começou assim e trocou pelas filas.
- **Entrega exatamente uma vez:** não existe entre o Postgres e o Redis sem uma transação distribuída. O projeto aceita "pelo menos uma vez" e paga com o consumidor idempotente.
- **CQRS completo, com modelo e banco de leitura separados:** escala leitura e escrita de forma independente. Em troca, a leitura fica eventualmente consistente, e cada mudança de tela exige atualizar uma projeção. Só compensa com um volume ou um formato de leitura que o banco de escrita não atende.

## Decisões relacionadas

Nenhum ADR trata deste desenho: o porquê está nesta página.
