---
type: explanation
---

# Redis

Por que o projeto usa um Redis, como os três usos dividem a mesma instância, o que acontece quando ele cai, e por que o cache e os jobs agendados funcionam como funcionam. Os passos estão em [Como cachear uma leitura](../how-to/cachear-uma-leitura.md) e [Como agendar um job](../how-to/agendar-um-job.md). As filas de eventos estão em [Consistência e eventos](consistencia-e-eventos.md#uma-fila-por-consumidor).

## Contexto

A app foi feita para rodar em mais de uma instância. Três coisas que em uma instância cabem na memória do processo deixam de funcionar assim:

- **Cache da leitura:** um cache em memória não fica sabendo da invalidação feita em outra instância.
- **Rate limit:** cada instância contaria só as próprias requisições, e o limite real seria multiplicado pelo número de instâncias.
- **Jobs agendados:** um `@Cron` do `@nestjs/schedule` dispara em todas as instâncias ao mesmo tempo.

As filas dos eventos de integração e os jobs usam o BullMQ, que roda sobre o Redis. Com o Redis no projeto por causa delas, o cache e os contadores do rate limit vão para o mesmo lugar, e todas as instâncias passam a ver o mesmo estado.

## Por quê

### Uma instância para filas e cache, só em desenvolvimento

O BullMQ exige a política de memória `noeviction`. Com qualquer outra, o Redis pode apagar chaves das filas quando a memória enche, e jobs somem. Um Redis só de cache costuma usar `allkeys-lru`, que apaga as chaves menos usadas. A política vale para a instância inteira, e não por database.

O `docker-compose.yml` sobe uma instância só, com `noeviction` e AOF (`appendonly yes`, para não perder jobs num reinício). Ela atende os dois usos porque toda chave de cache tem TTL: a memória não cresce sem limite. Em produção, o recomendado são duas instâncias: a das filas com `noeviction` e AOF, e a do cache com uma política que apaga chaves ([Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados)).

### Dois clientes para o mesmo endereço

O BullMQ usa o `ioredis`, e o `@keyv/redis`, store do cache, usa o cliente `redis`. São conexões diferentes para o mesmo `REDIS_URL`, cada uma configurada para o seu papel:

- **Worker do BullMQ** (`BullMqConnection.worker`): `maxRetriesPerRequest: null`, exigido pelo BullMQ nos workers. O BullMQ só define esse valor sozinho quando cria a conexão, e o projeto passa uma instância pronta.
- **Quem enfileira e o rate limit** (`BullMqConnection.producer`): sem fila offline (`enableOfflineQueue: false`). Com o Redis fora do ar, o comando falha na hora, em vez de esperar a reconexão segurando a requisição. Pelo mesmo motivo, um comando enviado antes de a conexão ficar pronta também falharia, e o rate limit responderia 503 nas primeiras requisições. Por isso a subida espera até 5 s por essa conexão e, sem ela, segue (`PRODUCER_READY_TIMEOUT_MS`, no `bullmq-connection.ts`).
- **Cache e health check** (`RedisConnection`): também sem fila offline (`disableOfflineQueue: true`), com reconexão em segundo plano.

Todas as conexões têm um listener de `error`. Sem ele, uma queda de conexão vira exceção não tratada e derruba o processo.

### Redis fora do ar: cada uso falha do seu jeito

Nenhum uso espera o Redis voltar segurando uma requisição. O que acontece com cada um, conferido com o Redis parado e a app no ar:

| Uso | Com o Redis fora | Por quê |
| --- | --- | --- |
| Cache | A leitura vai direto ao banco, e o log mostra os avisos `redis connection error` e `cache store error` | O cache é otimização. Perdê-lo deixa a API mais lenta, não errada |
| Rate limit | 503 (`Rate limiting unavailable`) na hora, em todas as rotas limitadas. O `ThrottlerGuard` é global, e só o health fica fora dele: com o rate limit ligado, a API inteira responde 503, antes de chegar ao cache ou à outbox | Falha fechada: deixar passar abriria o limite de tentativas de login quando não dá para contá-las |
| Outbox | Os eventos ficam na tabela, e o relay tenta de novo com backoff. Depois de 8 falhas, o evento é marcado como morto (`deadAt`). Exceção: o primeiro envio a uma fila desde a subida não falha. A `Queue` do BullMQ espera a conexão ficar pronta, e o relay fica parado nesse lote, com a transação aberta, até o Redis voltar | A outbox existe para isso ([Consistência e eventos](consistencia-e-eventos.md#o-evento-sai-pela-outbox)) |
| Workers | Esperam a reconexão, com avisos no log, e voltam a processar sozinhos | Não há requisição esperando por eles |
| Agendador de jobs | A subida falha cerca de 15 s depois da primeira tentativa de conexão: até 5 s esperando a conexão das filas, mais os 10 segundos de timeout do registro dos jobs agendados | Sem o agendador, o job nunca rodaria, e ninguém perceberia |
| `/health/ready` | Responde 503, com o `redis` `down` (`The client is offline`), e volta a 200 quando o Redis volta | O orquestrador tira a instância do tráfego. O `/health/live` não depende do Redis |

A conexão do cache não bloqueia a subida. A app sobe sem cache, e o `/health/ready` acusa a falta. Já o registro dos jobs bloqueia, porque um job que não roda é um erro silencioso, e um cache ausente não é.

### Cache da leitura

O cache é um decorator em volta da query, ligado no módulo Nest no lugar dela. A application não sabe que ele existe. Fica só no lado da leitura, porque um agregado vindo do cache poderia estar velho na hora de ser alterado, e a [concorrência otimista](consistencia-e-eventos.md#concorrência-otimista-no-save) só pegaria o problema depois.

**Invalidação por evento, com geração.** Uma escrita no pedido precisa descartar todas as páginas da listagem daquele cliente, em qualquer combinação de `page` e `limit`. A API do cache (`get`, `set`, `del`, `clear`) não apaga por padrão de chave, e o `clear` apaga tudo. Varrer o Redis com `SCAN` em toda escrita custaria caro. Por isso cada cliente tem uma geração, que entra na chave de cada página. Invalidar é gravar uma geração nova: as páginas antigas deixam de ser lidas e expiram pelo TTL. É uma escrita só, e repeti-la não faz mal, então o handler dispensa o consumidor idempotente.

**TTL como rede de segurança.** A invalidação depende de um evento, e um evento pode atrasar ou, se uma escrita não publicar nada, nem existir. O TTL de 60 segundos limita o pior caso. A geração vive o dobro das páginas: se expirasse antes, voltaria ao valor inicial, e uma página antiga gravada nele voltaria a ser lida.

**Consistência eventual.** O evento sai pela outbox depois do commit. Logo depois de uma escrita, a listagem pode vir desatualizada pelo intervalo entre o commit e a entrega do evento. Para uma listagem, isso é aceitável. Uma leitura que precisa mostrar a escrita na hora, como a confirmação de um pagamento, não deve passar pelo cache: por isso o decorator repassa a consulta de um pedido (`GET /v1/orders/:id`) direto para a query do banco. Invalidar também no fluxo da escrita, a forma canônica do cache-aside, seria um segundo mecanismo ao lado do evento, igualmente sujeito a falha do Redis, e não ajudaria quem precisa da escrita na hora mais do que essa leitura direta.

**Store no Redis.** O cache em memória funcionaria com uma instância. Com várias, o evento de invalidação chega a uma só, e as outras continuam servindo a página velha até o TTL.

### Jobs agendados

Um job é uma porta de entrada, como um controller: só chama um caso de uso. O que muda é quem o dispara.

O `@Cron` do `@nestjs/schedule` roda dentro de cada processo. Com três instâncias, a expiração de pedidos rodaria três vezes a cada disparo, disputando as mesmas linhas. Os Job Schedulers do BullMQ guardam o agendamento no Redis: cada disparo vira um job, e um worker só o pega. O `upsertJobScheduler` é idempotente, então todas as instâncias podem registrá-lo na subida. A API antiga de repeatable jobs foi removida na v6 do BullMQ.

O ciclo comum (registrar o agendador, criar o worker, obedecer ao `JOBS_ENABLED`, parar no shutdown) fica numa base só no `shared`, o `ScheduledJobProcessor`. Algumas escolhas dele:

- **Concorrência global de 1** (`setGlobalConcurrency(1)`): uma execução por vez somando todas as instâncias. Uma execução longa não ganha uma segunda por cima dela no próximo disparo.
- **Uma fila por job:** o worker roda o mesmo `run()` para qualquer job da fila. Dois jobs na mesma fila rodariam um o caso de uso do outro.
- **Histórico curto:** cada job agendado guarda as 20 últimas execuções concluídas e as 100 últimas com falha (`removeOnComplete` e `removeOnFail` no `scheduled-job.processor.ts`).
- **Sem retry:** o template não tem `attempts`, então um job que falha não é repetido. O próximo disparo é a nova tentativa. Os dois jobs do projeto tratam o que estiver pendente quando rodam, e um disparo perdido não deixa nada para trás.

## Alternativas e trade-offs

- **Sem Redis, com tudo no Postgres:** com uma instância, cache e rate limit em memória bastam, e um job pode usar um lock no Postgres (`pg_try_advisory_lock`) para rodar uma vez só. O BullMQ 6 também tem um backend em Postgres, para filas sem operar um Redis. Em troca, com várias instâncias, o cache e o rate limit continuariam precisando de um store compartilhado.
- **Apagar as páginas em vez de trocar a geração:** com `SCAN` por padrão de chave, a memória é liberada na hora. Em troca, cada escrita varre o Redis, e uma invalidação que falha no meio deixa parte das páginas velhas.
- **Rate limit que deixa passar com o Redis fora:** a API seguiria atendendo. Em troca, o limite do login some justamente quando ninguém consegue contar as tentativas.
- **`@nestjs/bullmq` (`@Processor` e `WorkerHost`):** declara filas e workers por decorator. Serve bem para filas fixas. O projeto usa `Queue` e `Worker` do `bullmq` direto, porque a base dos jobs e as filas de eventos (uma por consumidor, descobertas na subida) são montadas em código.
- **Retry no job:** um `attempts` no template repetiria a execução falha antes do próximo disparo. Em troca, uma falha persistente rodaria várias vezes seguidas, e a concorrência de 1 seguraria o disparo seguinte.

## Decisões relacionadas

- [ADR 0003: Imports explícitos entre módulos, sem `@Global`](../adr/0003-imports-explicitos-entre-modulos.md): o cache e a conexão com o Redis são infraestrutura do `shared`, e por isso podem ser globais.
