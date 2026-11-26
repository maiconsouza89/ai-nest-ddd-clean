# Plano da outbox com o Redis fora do ar (#62)

A issue #62 mostra que, com os padrões do relay (`DEFAULT_OUTBOX_OPTIONS`), uma linha da outbox morre (`deadAt`) na 8ª falha, cerca de 2 min depois da primeira. Uma falha ao enfileirar no BullMQ conta como falha da linha. Então um Redis fora do ar por mais de uns 2 minutos, coisa comum num failover ou numa manutenção, mata os eventos gravados nesse período, e nenhuma página diz como trazê-los de volta. Pronto quando:

- um teste de integração derruba o Redis por mais tempo que a janela atual, e nenhuma linha pendente ganha `deadAt`;
- existe um caminho documentado para reprocessar linhas mortas, e uma linha reprocessada é entregue sem duplicar o efeito;
- o `outbox-e-filas.md`, o `operacao.md#redis-fora-do-ar` e o `entrega-de-eventos.md` estão atualizados;
- o `npm run ci` e o `npm run test:int` passam.

**Mudanças em relação ao texto da issue:**

- **Quase toda falha do publish é de infraestrutura.** O `payload` e o `metadata` vêm de colunas `jsonb` e sempre serializam, e o `jobId` (`<eventId>__<consumidor>`) não tem `:`. Uma fila que não existe também não é erro, porque o BullMQ cria as chaves. Sobram como falha que não é de infraestrutura os erros de configuração, como um consumidor com `:` no nome ou um `NOPERM` do Redis. Hoje, na prática, o `maxAttempts` mede quanto tempo o Redis ficou fora.
- **O enfileiramento falha na hora, ou espera a reconexão, conforme a fila.** O `producer` não tem fila offline (`enableOfflineQueue: false`). Com a fila já usada desde a subida, o `add` falha na hora, com `Stream isn't writeable and enableOfflineQueue options is false`. A primeira `Queue` de um consumidor criada com o Redis fora espera a conexão voltar (o `waitUntilReady` do BullMQ), e o relay fica parado nesse lote com a transação aberta. Depois de 60 s, o `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS` derruba a sessão, e o lote falha quando o Redis volta. Um Redis congelado (sem RST) pendura o `add` sem prazo. Por isso entra um prazo no publish.
- **Uma `Queue` pode ficar quebrada até o restart.** Se o Redis cai entre o `ready` e o `INFO` que o BullMQ faz ao iniciar a conexão, a promise de inicialização da `Queue` fica rejeitada para sempre (`get client()` devolve a mesma promise). O `BullMqPublisher` guarda a `Queue` num `Map`, e todo `add` daquele consumidor falharia até a app reiniciar. A correção entra aqui, porque o cenário é o mesmo.
- **Pausar o relay, e não adiar linha a linha.** Adiar cada linha sem contar a falha faria o relay tentar o lote inteiro a cada segundo, com um `warn` por linha. Na primeira falha de infraestrutura, o relay para o lote e o worker espera.

Tudo entra em **um PR**, na branch `fix/outbox-com-o-redis-fora-do-ar`. O registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

## Decisões

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-26, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Abordagem | As opções 2 e 3 da issue. Falha de infraestrutura não conta para o `deadAt`, e o reprocesso das linhas mortas vira um how-to. O `maxAttempts` continua 8, agora só para a falha que não é de infraestrutura |
| Como o relay reconhece a falha | Por um erro tipado, `EventTransportUnavailableError`, declarado ao lado do port em `src/shared/application/ports/event-publisher.ts`. É uma subclasse de `Error`, e não de `DomainError`, com a causa original no `cause`. O comentário do port diz que o `publish` rejeita com ele quando o transporte está fora, e que o relay não conta essa falha. O relay testa com `instanceof` e não importa o ioredis nem o BullMQ |
| Quem classifica | O `BullMqPublisher`, por uma função pura em `src/shared/infra/messaging/transport-failure.ts`. Falha de infraestrutura é: o `TimeoutError` do prazo do publish; o `producer` fora de `ready` quando o erro chega; um erro de conexão pelo `isNotConnectionError` do BullMQ (negado); ou um `ReplyError` com prefixo `READONLY`, `LOADING`, `MASTERDOWN` ou `OOM`. O status da conexão vem primeiro: ele não depende da mensagem, que muda entre versões do ioredis (o 6 está na tabela de exceções) |
| Fan-out com falhas misturadas | Se algum consumidor falhou por infraestrutura, o publish inteiro rejeita com o erro tipado. O relay repete tudo depois, e o `jobId` ignora o job que já entrou |
| Pausa | Na primeira falha de infraestrutura do lote, o relay para de percorrer as linhas. Ele não grava nada na linha que falhou (`attempts`, `nextAttemptAt` e `lastError` ficam como estavam) e faz o commit do que já foi publicado no lote. Depois do commit, o `runOnce` rejeita com o erro tipado. O retorno no caminho normal continua sendo o número de linhas tentadas |
| Espera do worker | Ao receber o erro tipado, o `OutboxWorker` espera com backoff próprio: 1 s, 2 s, 4 s e assim por diante, até 30 s (`PAUSE_MAX_MS`), e volta a 1 s na primeira rodada sem o erro. Com o Redis de volta, a entrega recomeça em até 30 s. São constantes no worker, sem variável de ambiente, como o `POLL_INTERVAL_MS`. O `sleep` continua acordando no desligamento |
| Logs da pausa | Um `warn` `outbox relay paused: event transport unavailable`, com a mensagem da causa, ao entrar na pausa, e um `info` `outbox relay resumed` ao sair. As rodadas no meio da pausa não logam. O relay não loga a falha de infraestrutura: quem loga é o worker |
| Prazo do publish | `withTimeout` (`src/shared/infra/resilience/with-timeout.ts`) em volta de cada `add`, com `ENQUEUE_TIMEOUT_MS = 5_000` no `BullMqPublisher`. O valor é o mesmo do `PRODUCER_READY_TIMEOUT_MS` e fica bem abaixo dos 60 s do `idle_in_transaction_session_timeout`. Como a pausa para o lote na primeira falha, uma rodada espera no máximo um prazo. O `withTimeout` não cancela o `add`: se o Redis voltar, o job pode entrar depois, e a próxima rodada o encontra pelo `jobId` |
| `Queue` quebrada | Numa falha de infraestrutura de um consumidor, o `BullMqPublisher` tira a `Queue` dele do `Map` e a fecha em segundo plano (`close().catch(() => undefined)`). O próximo publish cria outra. Isso cobre a inicialização rejeitada sem precisar reconhecê-la. O passo 2 confere que o `close()` de uma `Queue` sobre o `producer` não fecha o `producer` |
| Checagem antes do lote | Nenhuma. O relay só conhece o port, e o primeiro publish falha em milissegundos (fila já usada) ou no prazo de 5 s (fila nova) |
| Reprocesso | How-to `docs/how-to/reprocessar-eventos-mortos.md`, com SQL: primeiro um `SELECT` para inspecionar, depois um `UPDATE` com filtro por `type` e por período de `deadAt`, dentro de uma transação. O `UPDATE` zera o `deadAt`, o `attempts` e o `nextAttemptAt` (`now()`), e mantém o `lastError` até a próxima falha. O SQL roda em qualquer ambiente sem build nem `ts-node`. Um comando no `package.json` fica em Evoluções com gatilho |
| Efeito duplicado no reprocesso | Nenhum. A linha reprocessada leva o mesmo `eventId`, e o `IdempotentConsumer` pula o efeito já marcado em `shared.processed_events` (PK `eventId`, `consumer`). Na fila, o `jobId` ignora o job que ainda existe. O how-to avisa duas coisas: o job que morreu no BullMQ (conjunto `failed`) não volta pelo reprocesso da outbox, e a linha revivida segura os pendentes seguintes do mesmo agregado até ser entregue |
| Alerta | Uma linha nova nos alertas de exemplo do `docs/reference/observabilidade.md`: eventos mortos, `outbox.events` com `outbox.event.state=dead` acima de 0. Com a mudança, um morto indica defeito, e não uma queda do Redis |
| Teste da queda | Int-spec com Redis próprio (`startRedisContainer`) atrás de um proxy TCP em processo (`test/helpers/tcp-proxy.ts`, com `node:net`). O teste fecha o proxy para derrubar o Redis e o reabre na mesma porta para trazê-lo de volta. O `restart()` do Testcontainers pode trocar a porta mapeada, e o `stop()` remove o container. O relógio do relay é falso, então a janela de 2 min passa sem espera real. Sem dependência nova: o `@testcontainers/toxiproxy` faria o mesmo com mais um pacote |
| ADR | A 0016, "Falha de transporte não conta para a morte do evento da outbox". Ela supera a frase da seção Consequences da 0015 sobre o Redis fora do ar, e a 0015 não é editada. O número é coordenado com a #48 pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum) |
| Tipo do commit e do PR | `fix(outbox)`. Sem `!`: o contrato HTTP, as variáveis e os eventos não mudam |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Comando para reprocessar os mortos (`npm run outbox:reprocess`, com variante sobre o `dist/`) | Linha em Evoluções com gatilho. Gatilho: o reprocesso virar rotina, ou quem opera não ter acesso ao banco por SQL |
| A mesma `Queue` quebrada no `QueueMetrics` (`src/shared/infra/messaging/queue-metrics.ts`), que cria as filas dele na subida | O passo 2 confere. Se o defeito se repetir lá, abra uma issue com o ok do dono: a métrica falha, mas nenhum evento se perde |
| Limpeza das linhas mortas | Já está em Evoluções com gatilho. A linha passa a citar o how-to de reprocesso |
| Pausar o relay quando o Postgres cai | Nenhum. A falha do Postgres derruba o lote inteiro, que já é logado como `Outbox batch failed`, e não mata linha |

## Referências

- Issue #62: `gh issue view 62`.
- Versões instaladas em 2026-11-26 (`npm ls`): `bullmq` 6.7.10, `ioredis` 5.11.1 (exceção em [Versões e exceções](../reference/versoes-e-excecoes.md), presa pelo peer do `typeorm`), `testcontainers` e `@testcontainers/redis` 12.2.2. Na execução, confira de novo.
- BullMQ, consultado no Context7 em 2026-11-26 (`/websites/bullmq_io`, "Failing fast when Redis is down"): com `enableOfflineQueue: false`, o `add` falha rápido, e o Redis precisa estar no ar quando a `Queue` é criada.
- ioredis, consultado no Context7 em 2026-11-26 (`/redis/ioredis`): o `enableOfflineQueue`, o `maxRetriesPerRequest` (padrão 20, com `MaxRetriesPerRequestError` ao esgotar) e o `autoResendUnfulfilledCommands`.
- Código instalado, lido porque a documentação não diz:
  - `ioredis/built/Redis.js` (por volta da linha 376): a rejeição na hora sem fila offline;
  - `ioredis/built/redis/event_handler.js`: o comando em voo, rejeitado com `MaxRetriesPerRequestError` depois de cerca de 20 tentativas de reconexão;
  - `bullmq/dist/esm/classes/redis-connection.js`: o `init()` com `waitUntilReady` e o `INFO` da versão (linhas 150-157 e 265-285), e o `get client()` que devolve a mesma promise;
  - `bullmq/dist/esm/utils/index.d.ts`: o `isNotConnectionError`, exportado pela raiz do pacote;
  - `bullmq` `addStandardJob` e `handleDuplicatedJob`: um `jobId` que já existe não cria job, seja qual for o estado.
- Código do projeto:
  - `src/shared/infra/outbox/`: `outbox-relay.ts` (`CLAIM_SQL`, `runOnce` e `recordFailure`), `outbox-worker.ts`, `outbox-metrics.ts`, `outbox-message.orm-entity.ts`, `outbox.module.ts` e os testes `outbox-relay.spec.ts`, `outbox-relay.int-spec.ts` e `idempotent-consumer.int-spec.ts`;
  - `src/shared/infra/messaging/`: `bullmq-connection.ts`, `bullmq-publisher.ts`, `event-subscriptions.ts` (`openEventQueue`), `queue-metrics.ts` e `messaging.int-spec.ts`, que é o molde do teste com o `MessagingModule`;
  - `src/shared/application/ports/event-publisher.ts`, `src/shared/application/idempotent-consumer.ts` e `src/shared/infra/resilience/with-timeout.ts`;
  - `test/fakes/fake-event-publisher.ts`, `test/helpers/redis.ts` (`startRedisContainer`), `test/helpers/outbox-database.ts` e `test/helpers/wait-for.ts`;
  - `src/modules/orders/infra/cache/cached-order.queries.int-spec.ts`, com um precedente de Redis derrubado no meio do teste.
- Páginas a mudar:
  - `docs/reference/outbox-e-filas.md`: a tabela de padrões ("Falhas até morrer" e a janela de 2 min), o parágrafo "Falha" e a coluna `attempts`;
  - `docs/reference/operacao.md`: a linha da outbox em [Redis fora do ar](../reference/operacao.md#redis-fora-do-ar) e os logs dela;
  - `docs/explanation/entrega-de-eventos.md`: o limite de tentativas e a frase que dá o Redis fora do ar como exemplo de `deadAt`;
  - `docs/explanation/redis.md`: "falha na hora", que não vale para a primeira `Queue`, e o bullet da outbox na queda;
  - `docs/reference/observabilidade.md` (alertas de exemplo), `docs/reference/evolucoes-com-gatilho.md` (limpeza das mortas e o comando de reprocesso) e `docs/how-to/fazer-o-deploy.md` (confira a menção à limpeza);
  - `docs/README.md` (how-to novo e ADR 0016) e a rota "Mexer na outbox, nas filas ou no consumidor idempotente" do `AGENTS.md`.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): o `docs/README.md` e o `AGENTS.md` com a #60, em linhas diferentes. Até o merge da #49, rode o `test:int` no worktree com `MAILPIT_TAG=` na frente.

## Como usar

- Execute os passos em ordem, um commit por passo que muda arquivo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal: data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR e comentário na issue só com o ok do dono do repositório.
- Não pare o Redis do docker-compose: os worktrees o compartilham. As conferências com o Redis fora do ar usam um container descartável próprio, removido no fim.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Reprodução e conferências | ✅ |
| 3 | Erro tipado e classificação no publisher | ✅ |
| 4 | Prazo do publish e `Queue` quebrada | ✅ |
| 5 | Pausa do relay e espera do worker | ✅ |
| 6 | Teste da queda do Redis | ✅ |
| 7 | Reprocesso: teste e how-to | ✅ |
| 8 | ADR 0016 e documentação | ⬜ |
| 9 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha J a partir da `main`, com a branch `fix/outbox-com-o-redis-fora-do-ar`, e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)). Este plano já está na `main`.
2. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #62 como 🟡.
3. Commit: `docs(plan): começa a correção da outbox com o Redis fora do ar (#62)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: reprodução e conferências

Sem mudar código. O resultado entra na descrição do PR.

1. Suba um Redis descartável numa porta fixa e livre, só para esta trilha: `docker run -d --name outbox-62-redis -p 6390:6379 redis:8`.
2. `npm run build`, `npm run db:setup` e `npm run db:seed` no worktree. Suba a app com `REDIS_URL=redis://127.0.0.1:6390 OUTBOX_WORKER_ENABLED=true QUEUE_WORKERS_ENABLED=true node dist/main.js`, com o `start:dev` do worktree parado.
3. Gere eventos com o Redis no ar (um cadastro em `POST /v1/auth/register`), para as filas serem usadas, e confira que o evento é entregue.
4. Derrube o Redis por 3 min de dois jeitos: `docker stop` e `docker start outbox-62-redis` (caiu) e `docker pause` e `docker unpause outbox-62-redis` (congelado). Em cada caso, com eventos novos gerados durante a queda:
   - meça em quanto tempo as linhas ganham `deadAt` (`SELECT id, attempts, "deadAt", "lastError" FROM shared.outbox ORDER BY seq DESC LIMIT 10`);
   - anote se o `add` falha na hora ou pendura, e a mensagem do `lastError`.
5. Num arquivo de rascunho fora do repositório, confira no código instalado:
   - que o `close()` de uma `Queue` criada sobre uma instância do ioredis não fecha essa instância (a conexão é marcada como compartilhada). Se fechar, pare e leve ao dono;
   - que `import { isNotConnectionError } from 'bullmq'` resolve;
   - se o `QueueMetrics` pode ficar com uma `Queue` quebrada do mesmo jeito (ver [Fora do plano](#fora-do-plano)).
6. Pare a app e remova o Redis descartável: `docker rm -f outbox-62-redis`. Sem commit.

### Passo 3: erro tipado e classificação

1. Em `src/shared/application/ports/event-publisher.ts`, declare o `EventTransportUnavailableError extends Error`, com `cause` no construtor e `name` fixo. Atualize o comentário do `publish`: ele rejeita com esse erro quando o transporte está fora, e o worker espera sem contar a falha da linha. Qualquer outra rejeição conta.
2. `src/shared/infra/messaging/transport-failure.ts`: a função pura `isTransportFailure(error: unknown, producerStatus: string): boolean`, com os critérios da tabela de decisões, e um comentário dizendo por que o status vem antes da mensagem.
3. `src/shared/infra/messaging/transport-failure.spec.ts`: um caso por critério, e os casos negativos (um `Error` qualquer com o `producer` em `ready`, e um `ReplyError` `NOPERM`).
4. No `BullMqPublisher.publish`, depois do `allSettled`: se alguma rejeição for falha de infraestrutura (com o `this.connection.producer.status` lido ali), lance `EventTransportUnavailableError` com a primeira delas como `cause`. Senão, lance a primeira rejeição, como hoje. Atualize o comentário da classe e o do `producer` no `bullmq-connection.ts`: o relay deixa de "registrar a falha" e passa a pausar.
5. `npm run typecheck`, `npm run lint`, `npm run arch` e `npm test -- transport-failure`.
6. Commit: `fix(messaging): o publish diz quando o Redis está fora, com um erro próprio (#62)`.

### Passo 4: prazo do publish e `Queue` quebrada

1. No `BullMqPublisher`, envolva cada `add` em `withTimeout(() => ..., ENQUEUE_TIMEOUT_MS)`, com a constante de 5 s e um comentário: o prazo protege a transação do lote, e o `add` que termina depois do prazo é ignorado pelo `jobId` na próxima rodada.
2. Na falha de infraestrutura de um consumidor, tire a `Queue` dele do `Map` e feche-a em segundo plano. Não tire a `Queue` numa falha que não é de infraestrutura.
3. Em `src/shared/infra/messaging/messaging.int-spec.ts`, ou num arquivo próprio se ficar confuso, um caso com o Redis compartilhado: o publish de um evento para um consumidor que já existe continua criando um job só, com o `jobId` de sempre.
4. `npm run typecheck`, `npm run lint` e `npm run test:int -- messaging`.
5. Commit: `fix(messaging): prazo no enfileiramento e fila recriada depois de uma queda do Redis (#62)`.

### Passo 5: pausa do relay e espera do worker

1. `OutboxRelay.runOnce`: no `catch`, se o erro for `EventTransportUnavailableError`, guarde-o e saia do laço, sem chamar o `recordFailure`. Depois do commit da transação, rejeite com ele. Comente por que o erro sai só depois do commit: as linhas já publicadas no lote ficam marcadas.
2. `OutboxWorker.run`: no `catch`, separe o erro tipado do resto:
   - erro tipado: entra na pausa (log `warn` só na primeira rodada), dorme o backoff da pausa e dobra o próximo, até `PAUSE_MAX_MS`;
   - outro erro: continua como hoje (`Outbox batch failed`);
   - rodada sem erro depois de uma pausa: log `info` `outbox relay resumed` e o backoff volta ao início.
3. `test/fakes/fake-event-publisher.ts`: um `unavailable` (booleano) que faz o `publish` rejeitar com o erro tipado.
4. Em `outbox-relay.int-spec.ts`, com `maxAttempts: 2`:
   - com o publisher indisponível, o `runOnce` rejeita com o erro tipado, e a linha fica com `attempts` 0, sem `deadAt` e sem `lastError`;
   - num lote de três, com o segundo indisponível, o primeiro fica publicado e o terceiro não é tentado;
   - dez rodadas indisponíveis, com o relógio avançando `maxDelayMs` em cada uma, e nenhuma linha morre; com o publisher de volta, a linha é entregue;
   - a falha comum continua contando e matando a linha no limite, como nos testes que já existem.
5. `src/shared/infra/outbox/outbox-worker.spec.ts`, com um relay falso e `vi.useFakeTimers()`: as esperas da pausa dobram até 30 s, o `warn` sai uma vez por pausa, o `info` sai na volta, e o `onModuleDestroy` acorda o worker no meio da pausa. Para os logs, espie o `Logger` do Nest (`vi.spyOn(Logger.prototype, 'warn')`).
6. `npm run typecheck`, `npm run lint`, `npm run arch`, `npm test -- outbox-worker` e `npm run test:int -- outbox-relay`.
7. Commit: `fix(outbox): falha de transporte pausa o relay sem contar para a morte do evento (#62)`.

### Passo 6: teste da queda do Redis

1. `test/helpers/tcp-proxy.ts`: um proxy TCP em processo (`node:net`) numa porta livre, com `close()`, que para de aceitar conexões e destrói as abertas, e `open()`, que volta a escutar na mesma porta. Explique no topo do arquivo por que o teste não usa o `restart()` do Testcontainers.
2. `src/shared/infra/outbox/outbox-redis-down.int-spec.ts`, no molde do `messaging.int-spec.ts`:
   - `startOutboxDatabase()`, `startRedisContainer()` e o proxy na frente dele, com `hookTimeout` maior no `beforeAll`, como no `cached-order.queries.int-spec.ts`;
   - um `TestingModule` com o `MessagingModule`, o `REDIS_URL` apontando para o proxy, `QUEUE_WORKERS_ENABLED: 'false'` e dois handlers de teste em consumidores diferentes;
   - um `OutboxRelay` sobre o `BullMqPublisher` real, com relógio falso e as opções padrão.
3. Casos:
   - **Fila já usada:** um evento entregue com o Redis no ar (aquece a fila do primeiro consumidor). Feche o proxy e espere o `producer` sair de `ready` (`waitFor`). Grave um evento novo e rode rodadas suficientes para passar da janela antiga (8 falhas), avançando o relógio `maxDelayMs` em cada uma. Nenhuma linha ganha `deadAt` nem `attempts`. Reabra o proxy, espere o `ready`, rode o relay: o evento é publicado, e o job está na fila.
   - **Fila nova com o Redis fora:** com o proxy fechado, um evento de um tipo assinado só pelo segundo consumidor, cuja `Queue` ainda não existe. O `runOnce` rejeita com o erro tipado em até uns 6 s, sem morrer a linha. Com o proxy de volta, o evento é entregue (a `Queue` recriada).
4. `npm run test:int -- outbox-redis-down`, três vezes seguidas, para pegar instabilidade.
5. Commit: `test(outbox): o Redis fora do ar além da janela antiga não mata eventos (#62)`.

### Passo 7: reprocesso

1. `npm run plop doc how-to "reprocessar eventos mortos"`. O how-to traz:
   - quando usar: linhas com `deadAt` depois de corrigida a causa, que está no `lastError`;
   - o `SELECT` de inspeção por `type` e período de `deadAt`, com o `lastError`;
   - o `UPDATE` em transação, com o mesmo filtro, conferindo o número de linhas afetadas antes do `COMMIT`;
   - como acompanhar: o log `delivering event` e o `outbox.events` com `dead` caindo;
   - os dois avisos da tabela de decisões (o job morto no BullMQ e a ordem por agregado), com links para [Outbox e filas](../reference/outbox-e-filas.md) e [Entrega de eventos](../explanation/entrega-de-eventos.md);
   - "Como verificar": a linha sai de `dead` e ganha `publishedAt`.
2. `src/shared/infra/outbox/outbox-reprocess.int-spec.ts`, com o `startOutboxDatabase()`, a tabela `shared.effects` do `idempotent-consumer.int-spec.ts` e um publisher falso que chama um handler com o `IdempotentConsumer` e depois falha, até a linha morrer com `maxAttempts: 2`. Rode o `UPDATE` do how-to, com o mesmo texto e um comentário apontando para a página. Com o publisher funcionando, o relay entrega a linha, e o efeito continua uma vez só.
3. `npm run test:int -- outbox-reprocess` e `npm run docs:check`.
4. Commit: `docs(outbox): how-to para reprocessar eventos mortos, com teste do caminho (#62)`.

### Passo 8: ADR 0016 e documentação

1. Confira no `docs/adr/` e no roadmap se o 0016 ainda está livre. `docs/adr/0016-falha-de-transporte-nao-mata-evento-da-outbox.md`, no formato da 0015 (frontmatter `status: accepted`, contexto, decisão em bullets, `## Considered Options` com as opções 1, 2 e 3 da issue, e `## Consequences`). Diga que ela supera a frase da 0015 sobre o Redis fora do ar.
2. `docs/reference/outbox-e-filas.md`: "Falhas até morrer" conta só a falha que não é de transporte, a janela de 2 min sai, o parágrafo "Falha" ganha a pausa e o prazo de 5 s, e a coluna `attempts` diz "Falhas de entrega, sem contar as de transporte". Link para o how-to de reprocesso onde fala das linhas mortas.
3. `docs/reference/operacao.md`, linha da outbox em "Redis fora do ar": o relay pausa e tenta de novo em até 30 s, nenhuma linha morre, a fila nova espera até 5 s, e os logs passam a ser `outbox relay paused: event transport unavailable` e `outbox relay resumed`.
4. `docs/explanation/entrega-de-eventos.md`: o porquê de a falha de transporte não contar, a frase que dá o Redis fora do ar como exemplo de `deadAt` e o reprocesso.
5. `docs/explanation/redis.md`: o "falha na hora" ganha a exceção da fila nova, e o bullet da outbox na queda diz que o relay pausa sem contar a falha.
6. `docs/reference/observabilidade.md`: a linha do alerta de eventos mortos.
7. `docs/reference/evolucoes-com-gatilho.md`: a limpeza das mortas cita o how-to, e entra a linha do comando de reprocesso. Confira a menção à limpeza no `docs/how-to/fazer-o-deploy.md`.
8. `docs/README.md`: o how-to na lista (perto do de publicar um evento) e a ADR 0016 no índice. No `AGENTS.md`, a rota "Mexer na outbox, nas filas ou no consumidor idempotente" ganha o caminho do how-to.
9. `npm run docs:check`.
10. Commit: `docs(outbox): ADR 0016 e páginas da outbox com o Redis fora do ar (#62)`.

### Passo 9: verificação, revisão, registro e PR

1. `npm run ci`. A mudança toca banco, Redis e filas: rode também `npm run test:int` e, com o `start:dev` do worktree parado, `npm run test:e2e`.
2. Conferência manual, repetindo o passo 2 com o Redis descartável e o build novo: o Redis fora por 3 min, nos casos "caiu" e "congelado", sem nenhuma linha com `deadAt`. Um `warn` de pausa, um `info` de volta, e os eventos entregues em até 30 s depois da volta. No fim, `docker rm -f outbox-62-redis`.
3. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar código, repita os itens 1 e 2.
4. Faça rebase sobre a `main` e rode `npm run ci` de novo. Se a #48 tiver entrado com a ADR 0016, renumere a desta trilha e os links.
5. Com o ok do dono, faça push e abra o PR com o título `fix(outbox): Redis fora do ar pausa o relay em vez de matar os eventos (#62)`. A descrição traz:
   - as mudanças em relação à issue: o publish que quase só falha por infraestrutura, a fila nova que espera a conexão, a `Queue` quebrada e a pausa em vez do adiamento linha a linha;
   - a medição do passo 2 e a conferência do item 2;
   - o que ficou em [Fora do plano](#fora-do-plano).
6. Com o ok do dono, deixe na issue um comentário de registro com este plano e os mesmos pontos da descrição. Se a conferência do `QueueMetrics` achou o mesmo defeito, abra a issue dele.
7. Último commit da branch, `docs(plan): fecha o plano da outbox com o Redis fora do ar (#62)`:
   - apague este plano;
   - no roadmap, marque a #62 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #62, como os das outras issues;
   - rode `npm run docs:check` de novo e faça push.
