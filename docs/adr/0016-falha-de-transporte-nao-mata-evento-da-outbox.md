---
status: accepted
---

# Falha de transporte não conta para a morte do evento da outbox

O relay da outbox contava toda falha ao enfileirar no BullMQ como falha da linha. Com os padrões (8 falhas, backoff de 1 s a 64 s), a 8ª falha chega cerca de 2 min depois da primeira. Um Redis fora do ar por mais tempo que isso, comum num failover ou numa manutenção, matava (`deadAt`) os eventos gravados no período, e só uma intervenção manual na tabela os trazia de volta. Na prática, quase toda falha do publish é de transporte: o `payload` e o `metadata` vêm de colunas `jsonb` e sempre serializam, o `jobId` não tem `:`, e o BullMQ cria a fila que não existe. O limite de falhas media quanto tempo o Redis ficou fora, e não se o evento tinha defeito.

O relay passa a separar a falha de transporte da falha do evento, e a primeira não conta para o `deadAt`.

- **Erro tipado no port:** o `EventPublisher.publish` rejeita com `EventTransportUnavailableError` quando o transporte está fora. O relay o reconhece por `instanceof` e não conhece o ioredis nem o BullMQ.
- **Classificação no adapter:** o `BullMqPublisher` decide pela função `isTransportFailure`: o prazo do publish estourado, o `producer` fora de `ready`, um erro de conexão, ou uma resposta `READONLY`, `LOADING`, `MASTERDOWN` ou `OOM`. O status da conexão vem antes da mensagem, que muda entre versões do ioredis.
- **Pausa, e não adiamento linha a linha:** na primeira falha de transporte, o relay para o lote sem gravar nada na linha, confirma o que já publicou e rejeita. O `OutboxWorker` espera de 1 s a 30 s, dobrando, e loga só a entrada e a saída da pausa.
- **Prazo no publish:** 5 s por `add`. Um Redis congelado penduraria o `add` sem fim, e a fila criada com o Redis fora espera a conexão, com a transação do lote aberta.
- **Fila recriada:** numa falha de transporte, o publisher descarta a `Queue` do consumidor e cria outra no próximo publish. Uma `Queue` cuja inicialização caiu no meio fica rejeitada até o restart.
- **Reprocesso documentado:** as linhas mortas voltam à entrega por SQL ([Como reprocessar eventos mortos](../how-to/reprocessar-eventos-mortos.md)).

Esta decisão substitui a frase da seção Consequences da [ADR 0015](0015-outbox-e-filas-por-consumidor.md) que diz que, com o Redis fora do ar, o enfileiramento conta como falha da linha e o evento morre depois do limite. O resto da 0015 continua valendo. Os parâmetros estão em [Outbox e filas](../reference/outbox-e-filas.md#relay-da-outbox), e o raciocínio em [Entrega de eventos](../explanation/entrega-de-eventos.md).

## Considered Options

- **Subir o `maxAttempts`:** com o teto de 5 min, 12 falhas dão cerca de 18 min, e 15 dão cerca de 33 min. Muda uma linha, mas só alarga a janela, e o evento com defeito próprio também demora mais para morrer.
- **Não contar a falha de transporte, com o reprocesso como how-to:** a escolhida. Uma queda de qualquer duração não mata evento, e o `deadAt` volta a indicar defeito.
- **Só reprocessar os mortos:** um how-to ou um comando que devolve as linhas mortas à busca. Vale com qualquer das opções, mas sozinho deixa a queda do Redis matando eventos, e alguém precisa perceber e intervir.
- **Adiar cada linha sem contar a falha:** sem pausa, o relay tentaria o lote inteiro a cada segundo, com um `warn` por linha.
- **Checar o Redis antes de cada lote:** o relay precisaria conhecer o transporte, e o primeiro publish já falha em milissegundos, ou no prazo de 5 s.

## Consequences

- Uma queda do Redis, de qualquer duração, não mata evento. A entrega recomeça em até 30 s depois da volta.
- O `maxAttempts` continua 8, e só a falha que não é de transporte conta. Um evento morto indica um defeito, como um consumidor com nome inválido ou um `NOPERM` do Redis, e vira alerta ([Observabilidade](../reference/observabilidade.md#alertas-de-exemplo)).
- Durante a pausa, a fila de um consumidor é recriada a cada rodada, e cada rodada espera até o prazo de 5 s com a transação do lote aberta, bem abaixo dos 60 s do `idle_in_transaction_session_timeout`.
- O `add` que termina depois do prazo não é cancelado. O job pode entrar na fila mais tarde, e a próxima rodada o encontra pelo `jobId`, sem duplicar.
- Uma falha que deveria contar, mas chega com o `producer` fora de `ready`, é tratada como de transporte e só conta depois que o Redis volta.
- O `QueueMetrics` cria as filas dele na subida e as mantém, e pode ficar com uma `Queue` rejeitada do mesmo jeito. Fica fora desta decisão: a métrica falha, mas nenhum evento se perde.
