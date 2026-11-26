---
type: explanation
---

# Entrega de eventos

Por que um evento de integração só sai depois que o agregado é salvo, por que cada consumidor tem a própria fila e por que um evento pode chegar mais de uma vez sem repetir o efeito. Os parâmetros da outbox e das filas estão em [Outbox e filas](../reference/outbox-e-filas.md), o passo a passo para criar um evento em [Como publicar um evento de integração](../how-to/publicar-um-evento-de-integracao.md), e os eventos de cada módulo na página dele (por exemplo, [orders](../reference/modules/orders.md#eventos-publicados)).

## Contexto

Pagar um pedido termina avisando os outros módulos: o notifications manda o e-mail, e o cache da listagem é descartado. O aviso precisa resolver três problemas:

- **O aviso não pode mentir nem se perder.** Avisar antes de salvar anuncia algo que pode não ter acontecido. Avisar depois pode não acontecer se o processo cair no meio.
- **Um consumidor não pode atrapalhar os outros.** Um handler lento ou com falha não deve atrasar nem repetir o aviso para quem já o tratou.
- **O aviso pode chegar duas vezes.** Toda entrega com nova tentativa pode repetir, e o consumidor precisa produzir o efeito uma vez só.

A gravação do agregado e do evento na mesma transação está em [Transações e concorrência](transacoes-e-concorrencia.md).

## Por quê

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

Um relay lê a outbox em lotes e entrega cada evento. Com um lote cheio, ele busca de novo na hora, porque ainda deve haver pendentes. Com um lote incompleto, espera um pouco antes da próxima busca. A busca usa SQL escrito à mão:

- **`FOR UPDATE OF o SKIP LOCKED`:** dois processos com o relay ligado nunca pegam a mesma linha, e um não espera o outro. O `.setLock('pessimistic_write').setOnLocked('skip_locked')` do query builder não serve aqui, porque a busca tem uma subquery e o Postgres recusa travar o lado anulável de um outer join. O `OF o` trava só as linhas da outbox.
- **Ordem por agregado:** um `NOT EXISTS` deixa de fora um evento enquanto houver um anterior do mesmo agregado ainda por entregar, inclusive um que esteja esperando nova tentativa.
- **Falhas:** cada falha registra o erro e adia a próxima tentativa com backoff exponencial, com teto. Passado o limite de tentativas, a linha é marcada como morta (`deadAt`) e sai da busca. Daí em diante ela não segura mais os eventos seguintes do mesmo agregado, que saem sem ela. Manter a ordem a qualquer custo travaria o agregado para sempre por um evento que não vai sair; o projeto prefere entregar os seguintes e deixar o morto para inspeção manual. Corrigida a causa, o morto volta à entrega por SQL ([Como reprocessar eventos mortos](../how-to/reprocessar-eventos-mortos.md)), com o mesmo `eventId`, e o consumidor idempotente não repete o efeito. As métricas da outbox mostram os pendentes, os mortos e o atraso ([Observabilidade](../reference/observabilidade.md)).
- **Falha de transporte não conta:** com o Redis fora do ar, o relay pausa em vez de contar a falha das linhas, e volta a entregar quando o Redis volta ([Redis fora do ar não mata evento](#redis-fora-do-ar-não-mata-evento)).
- **Limpeza:** de tempos em tempos, o worker da outbox apaga os eventos publicados há mais que o prazo de retenção, em lotes, para um `DELETE` sobre um acúmulo grande não passar do `statement_timeout` e ser cancelado a cada rodada. As linhas mortas ficam de propósito. Nada apaga essas linhas, nem as de `shared.processed_events` e de `orders.idempotency_keys`, e as três tabelas crescem sem limite ([Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados)).

### Uma fila por consumidor

O relay não chama os handlers. Ele enfileira o evento no BullMQ, numa fila por consumidor, e marca a linha como publicada:

```text
caso de uso ─tx─▶ outbox (Postgres) ─relay─▶ fila por consumidor (Redis) ─▶ handler
```

Chamar os handlers no relay os poria dentro da transação que trava o lote: um handler lento seguraria o lote inteiro, e a falha de um consumidor faria o evento voltar para todos. Com uma fila para cada um, cada consumidor tem as suas tentativas e a sua fila de mortos, e os workers podem rodar num processo separado da API.

- **A outbox continua.** O Redis não participa da transação do Postgres. Enfileirar direto no caso de uso traria de volta o problema que a outbox resolve.
- **Fan-out pelo publicador.** No BullMQ, cada job vai para um worker só. O `BullMqPublisher` consulta quais consumidores assinam o tipo do evento e enfileira uma cópia para cada um. As assinaturas saem do `@IntegrationEventHandler` de cada handler, lido na subida pelo `DiscoveryService` do Nest, e cada módulo declara só os próprios handlers. Um evento sem assinante é aceito sem enfileirar nada.
- **Job repetido é ignorado.** O `jobId` junta o id do evento e o nome do consumidor, e o BullMQ ignora um job com id existente. Se o relay cair entre enfileirar e marcar a linha, a repetição não duplica o job. Isso só vale enquanto o job existir, e por isso os jobs concluídos são removidos por idade, e não logo ao terminar. Passada essa janela, quem barra a repetição é a marca de evento processado do consumidor.
- **Uma fila com problema não esconde as outras.** O publicador usa `Promise.allSettled`: tenta todas as filas e, se alguma falhar, o relay repete o evento depois. As filas que já tinham o job ignoram a repetição pelo `jobId`.
- **Duas filas de mortos.** Um job que esgota as tentativas fica no conjunto `failed` da fila do consumidor. O `deadAt` da outbox passa a valer só para o evento que não conseguiu ser enfileirado por um defeito, como um consumidor com nome inválido ou um Redis que recusa o comando por permissão. As métricas contam os mortos de cada lado ([Observabilidade](../reference/observabilidade.md)).
- **A ordem vale até a fila.** Dentro dela, um retry com backoff pode inverter dois eventos do mesmo agregado, então nenhum consumidor pode depender da sequência. Os do projeto não dependem: pago e cancelado são estados que se excluem.
- **O trace atravessa a fila.** O handler aparece no mesmo trace da requisição que originou o evento ([Observabilidade](observabilidade.md#o-trace-atravessa-a-outbox-e-as-filas)).

### Redis fora do ar não mata evento

Quase toda falha ao enfileirar é do transporte, e não do evento. O `payload` e o `metadata` vêm de colunas `jsonb` e sempre serializam, o `jobId` não tem `:`, e o BullMQ cria a fila que não existe. Se essas falhas contassem para o limite, ele mediria quanto tempo o Redis ficou fora: com os padrões, uma queda de uns 2 minutos, comum num failover, mataria os eventos gravados no período.

Por isso o publicador diz quando a falha é do transporte, com um erro próprio do port (`EventTransportUnavailableError`), e o relay não a conta. O relay só conhece o port: quem sabe reconhecer uma queda do Redis é o adapter do BullMQ, que olha primeiro o estado da conexão, porque a mensagem do erro muda entre versões do cliente.

- **Pausa, e não adiamento linha a linha.** Com o Redis fora, todas as linhas do lote falhariam igual. Adiar cada uma sem contar faria o relay tentar o lote inteiro a cada segundo, com um aviso por linha. Na primeira falha de transporte, o relay para o lote, confirma o que já publicou e espera, com um intervalo que dobra até 30 s. Um aviso marca a entrada na pausa e outro a saída.
- **Prazo no enfileiramento.** O relay enfileira com a transação do lote aberta. Um Redis congelado, que não fecha a conexão, deixaria o enfileiramento pendurado sem fim, e a fila criada com o Redis fora espera a conexão voltar. O prazo de 5 s limita a espera bem abaixo do tempo em que o Postgres derruba uma transação parada. O enfileiramento que termina depois do prazo não faz mal: a próxima rodada o encontra pelo `jobId`.
- **Fila recriada.** Se o Redis cai no meio da inicialização de uma fila do BullMQ, ela fica quebrada até o processo reiniciar, mesmo com o Redis de volta. O publicador descarta a fila do consumidor que falhou por transporte e cria outra no próximo envio.

O limite de falhas continua valendo para a falha que não é de transporte. Assim, um evento morto passa a indicar um defeito, e não uma queda do Redis.

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

## Alternativas e trade-offs

- **Publicar direto, depois do commit:** sem outbox nem relay. Mas se o processo cair entre o commit e a publicação, o evento se perde, e publicar antes do commit anuncia algo que pode ser desfeito.
- **Enfileirar no BullMQ dentro do caso de uso:** tira a outbox do caminho, mas o Redis não entra na transação do Postgres, e voltam os mesmos dois problemas.
- **Barramento em memória chamado pelo relay:** dispensa o Redis, mas o handler roda dentro da transação do lote, um handler lento segura todos e a falha de um devolve o evento a todos. O projeto começou assim e trocou pelas filas.
- **Entrega exatamente uma vez:** não existe entre o Postgres e o Redis sem uma transação distribuída. O projeto aceita "pelo menos uma vez" e paga com o consumidor idempotente.
- **Ordem estrita mesmo com evento morto:** o evento morto seguraria os seguintes do agregado até alguém intervir. O projeto troca a ordem estrita pela entrega dos seguintes.
- **Mais tentativas no lugar da pausa:** subir o limite de falhas alarga a janela que uma queda do Redis aguenta, mas não a elimina, e o evento com defeito próprio também demora mais para morrer.

## Decisões relacionadas

- [ADR 0015: Eventos de integração pela outbox, com uma fila por consumidor](../adr/0015-outbox-e-filas-por-consumidor.md)
- [ADR 0016: Falha de transporte não conta para a morte do evento da outbox](../adr/0016-falha-de-transporte-nao-mata-evento-da-outbox.md)
