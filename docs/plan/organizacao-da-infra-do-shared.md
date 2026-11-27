# Plano da organização da infra do shared (#68)

Em `src/shared/infra/`, a pasta de um arquivo não diz de quem ele é. O Redis está em três lugares: o `RedisConnection` em `cache/`, mas usado pelo health; o `BullMqConnection` em `messaging/`, mas usado pelo rate limit e pelos jobs. Por causa disso, o `identity` e o `orders` importam o `MessagingModule` inteiro só para os jobs receberem a conexão. A outbox está dividida entre `database/`, que registra as entities e liga `Outbox`, `ProcessedEvents` e `IdempotentConsumer`, e `outbox/`, que fica só com o relay. O `IdGenerator` é ligado em cada módulo de negócio, enquanto o `Clock` tem módulo global. A factory do rate limit está inline no `AppModule`. E nada separa o que os módulos podem importar do `shared/infra` do que é detalhe dele.

O plano não muda comportamento, fora as chaves do Redis no `/health/ready` (ver [Decisões](#decisões)). Pronto quando:

- toda pasta de `src/shared/infra/` é de **conexão** (cria e encerra clientes: `database/`, `redis/`) ou de **capacidade** (usa conexões e nunca as cria). A regra está no `docs/reference/camadas.md` e numa ADR;
- o `DatabaseModule` não conhece a outbox, e o `OutboxModule` liga a outbox e a inbox;
- as conexões do Redis ficam em `redis/`, com nome de papel, e o `/health/ready` confere as duas;
- nenhum módulo de negócio importa o `MessagingModule` nem liga o `IdGenerator`;
- o `AppModule` não tem factory de infra e lista os módulos em blocos comentados;
- o `npm run arch` barra um módulo que importe do `shared/infra` um arquivo fora da superfície pública;
- o `npm run ci`, o `npm run test:int` e o `npm run test:e2e` passam.

**Mudanças em relação à proposta discutida com o dono:**

- **Sem módulo agregador (`SharedInfraModule.forRoot`).** A ordem dos imports e o `@Global` decidem a ordem dos hooks de desligamento ([Operação → Desligamento](../reference/operacao.md#desligamento)), e um agregador esconderia essa ordem. Os exemplos da documentação do Nest listam a infra solta no `AppModule`, com comentários.
- **Sem barrel files.** A documentação do Nest avisa que um `index.ts` de módulos e providers causa dependência circular. A superfície pública é uma regra do dependency-cruiser.
- **Sem fixture de teste para a infra.** O dependency-cruiser já exclui os testes (`options.exclude`), e os int-specs montam adapters reais de propósito ([Testes](../reference/testes.md)).
- **Sem subpastas `http/errors/` e `http/pagination/`.** Só o rate limit ganha pasta própria, porque é uma capacidade sobre o Redis. O resto do `http/` são peças soltas da borda HTTP.

Tudo entra em **um PR**, na branch `refactor/infra-do-shared`, um commit por passo, com o CI verde em cada commit. O registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

## Decisões

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-27, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Regra das pastas | **Conexão:** `database/` e `redis/`. Criam os clientes, cuidam do ciclo de vida e não têm regra. **Capacidade:** `cache/`, `messaging/`, `outbox/`, `jobs/`, `http/rate-limit/`, `auth/` e `health/`. Recebem conexões por injeção e nunca chamam `createClient` nem `new Redis`. **Fundação:** `config/`, `observability/` e `runtime/`, portas que todo módulo usa. **Biblioteca:** `resilience/` e o resto de `http/`, funções e decorators sem módulo Nest |
| Outbox e inbox | O `OutboxModule` passa a ser `@Global`. Faz o `TypeOrmModule.forFeature` das duas entities e liga `Outbox`, `ProcessedEvents` e `IdempotentConsumer`, além do relay, do worker e das métricas. Exporta `Outbox` e `IdempotentConsumer`, como o `DatabaseModule` faz hoje. Continua importando o `MessagingModule`. É o recorte do `@nestjs/outbox` (outbox e inbox numa store, transporte à parte), o que reduz a troca prevista em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md) a uma pasta |
| `DatabaseModule` | Fica com o `TypeOrmModule.forRootAsync` e o `TransactionManager`, e exporta só o `TransactionManager` |
| Conexões do Redis | `redis/redis.module.ts`, `@Global`, exportando duas classes. **`QueueRedisConnection`** (← `BullMqConnection`), com `commands`, sem fila offline (← `producer`; usada para enfileirar, pelo rate limit e pelo health), e `blocking`, com `maxRetriesPerRequest: null` (← `worker`; usada pelos workers do BullMQ). **`CacheRedisConnection`** (← `RedisConnection`), com `client`. Comportamento, opções e hooks iguais aos de hoje. As duas leem o `REDIS_URL`; a URL própria do cache continua em Evoluções com gatilho |
| Por que o `RedisModule` continua `@Global` | Os módulos `@Global` rodam cada hook por último. O `beforeApplicationShutdown` da conexão do cache precisa rodar depois do atraso do Terminus ([Operação](../reference/operacao.md#desligamento)) |
| Nomes por papel | Os nomes `producer` e `worker` são do vocabulário do BullMQ, mas o rate limit e o health também usam a conexão. As ADRs 0015 e 0016 citam os nomes antigos e não são editadas. A ADR nova registra a troca |
| Health | O `RedisHealthIndicator` passa a ser `pingCheck(key, connection: 'cache' \| 'queue')`, com `PING` no `client` do cache ou no `commands` da fila. O `/health/ready` troca a chave `redis` por `redis-cache` e `redis-queue`. O orquestrador lê só o status HTTP, e o schema no OpenAPI é o genérico do Terminus. A mudança vai na descrição do PR, sem `!` |
| `RuntimeModule` | `runtime/runtime.module.ts`, `@Global`, liga `Clock` (`SystemClock`) e `IdGenerator` (`UuidV7Generator`). Substitui o `ClockModule` e as linhas `{ provide: IdGenerator, ... }` dos módulos e do template do plop |
| Rate limit | `http/rate-limit/rate-limit.options.ts` exporta `rateLimitOptions`, as opções do `ThrottlerModule.forRootAsync` (`inject` e `useFactory`, com o mesmo corpo de hoje). Para lá vão o storage, o guard e o `@ThrottleByAccount`. O `AppThrottlerGuard` continua no `providers` do `AppModule`, para não mudar a ordem dos guards globais (throttle, JWT, roles) |
| `AppModule` | Sem agregador. Blocos comentados, nesta ordem: fundação (`ConfigModule`, `ObservabilityModule`, `RuntimeModule`), conexões (`DatabaseModule`, `RedisModule`), capacidades (`OutboxModule`, `AppCacheModule`, `ThrottlerModule`), HTTP (`ProblemDetailsModule`, `JwtConfigModule`, `AuthModule`, `HealthModule`) e negócio |
| Superfície pública | Regra `shared-infra-so-pela-superficie` no `.dependency-cruiser.js`: código de `src/modules/` (os testes já ficam de fora) só importa de `src/shared/infra/` os arquivos de uma lista. O `comment` da regra diz onde acrescentar um arquivo e pede o ok na revisão. Lista inicial no [passo 9](#passo-9-superfície-pública-no-dependency-cruiser) |
| ADR | A 0017, "Infra do shared em pastas de conexão e de capacidade". Confira se o número ainda está livre: a #48 pode criar uma ADR antes |
| Tipo do commit e do PR | `refactor(shared)`, fora o do health (`feat(health)`) e os de documentação. Sem `!`: contrato HTTP de negócio, variáveis e eventos não mudam |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Separar o Redis em duas instâncias (`REDIS_CACHE_URL`) | Já está em Evoluções com gatilho (deploy em produção). A linha passa a dizer que a mudança fica no `cache-redis.connection.ts` e no health |
| Trocar a outbox própria pelo `@nestjs/outbox` (0.1.4 no npm em 2026-11-27) | Já está em Evoluções com gatilho (o pacote chegar à 1.0) |
| Trocar o BullMQ direto pelo `@nestjs/bullmq` | Nenhum. Resolveria quem é dono da conexão, mas mexe nas filas por consumidor da ADR 0015 sem ganho para a organização |
| Um cliente só do Redis (o `@keyv/redis` usa o `redis`, e o BullMQ usa o `ioredis`) | Nenhum. Cada uso pede uma configuração diferente ([Redis](../explanation/redis.md)) |
| `PING` na conexão `blocking` | Nenhum. O `commands` aponta para a mesma instância, e o `blocking` espera a reconexão por desenho |
| Subpastas `http/errors/` e `http/pagination/` | Nenhum, salvo pedido do dono. Seria só cosmético |

## Referências

- Versões instaladas em 2026-11-27 (`package.json`): `@nestjs/common` e `@nestjs/core` 12.6.0, `@nestjs/throttler` 6.8.0, `@nestjs/terminus` 12.2.0, `@nestjs/cache-manager` 12.0.5, `@keyv/redis` 5.1.6, `bullmq` 6.7.10, `ioredis` 5.11.1 e `typeorm` 1.1.3. Na execução, confira de novo.
- Nest, consultado no Context7 em 2026-11-27 (`/nestjs/docs.nestjs.com`):
  - "Modules → Global modules": registrar um módulo global uma vez só, na raiz; tornar tudo global não é boa prática;
  - "Circular dependency": evitar barrel files para módulos e providers;
  - "Tutorials → Background jobs": um `RedisModule` global que cria o cliente e o fecha no `onApplicationShutdown`, e a infra listada solta no `AppModule`, com comentários sobre a ordem;
  - "Reliability → Outbox": outbox e inbox numa store só, num schema próprio, com o `fromTypeOrm`;
  - "Security → Rate limiting": `storage` próprio pelo `forRootAsync`.
- BullMQ, consultado no Context7 em 2026-11-27 (`/websites/bullmq_io`): "Going to production" (`noeviction`, `enableOfflineQueue: false` em quem enfileira, `maxRetriesPerRequest: null` nos workers) e "Connections" (o worker duplica a conexão para os comandos bloqueantes).
- Código do projeto:
  - `src/app.module.ts`, `src/shared/infra/**/*.module.ts`, `cache/redis.connection.ts`, `messaging/bullmq-connection.ts`, `health/redis-health.indicator.ts`, `health/health.controller.ts` e `jobs/scheduled-job.processor.ts`;
  - quem usa o `BullMqConnection`: `messaging/` (`bullmq-publisher.ts`, `event-workers.ts`, `queue-metrics.ts`, `transport-failure.ts`, `messaging.module.ts`), `jobs/scheduled-job.processor.ts`, `outbox/outbox-redis-down.int-spec.ts`, os processors de `src/modules/identity/infra/jobs/` e `src/modules/orders/infra/jobs/` e o int-spec deste último;
  - quem usa o `RedisConnection`: `cache/cache.module.ts`, `health/redis-health.indicator.ts` e `src/modules/orders/infra/cache/cached-order.queries.int-spec.ts`;
  - `test/health.e2e-spec.ts` (troca o `RedisHealthIndicator` por um fake), `test/shutdown.e2e-spec.ts` e `test/throttle.e2e-spec.ts`;
  - `plop-templates/module/module.hbs` (liga o `IdGenerator`);
  - `.dependency-cruiser.js` (as regras de fronteira e o `exclude` dos testes).
- Páginas a mudar: `docs/reference/camadas.md` (seção do shared), `docs/explanation/redis.md`, `docs/reference/outbox-e-filas.md`, `docs/reference/operacao.md` (health, rate limit e a tabela de desligamento), `docs/reference/evolucoes-com-gatilho.md`, `docs/how-to/agendar-um-job.md`, `docs/how-to/criar-um-modulo.md` e as que o `grep` do passo 10 achar.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): a #48 pode criar uma ADR (numeração) e mexe no `docs/README.md` em outra seção.

## Como usar

- Execute os passos em ordem, um commit por passo que muda arquivo, e marque o passo no mapa.
- Cada passo tem **critérios de aceite**. O passo só termina com todos conferidos. Se um não fecha, pare e leve ao dono, sem afrouxar o critério.
- Mover um arquivo: use `git mv`, para o histórico seguir o arquivo, e leve junto os `*.spec.ts` e `*.int-spec.ts` dele.
- Escreva as páginas de forma atemporal: data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de issue e de PR e comentário na issue só com o ok do dono do repositório.
- Não pare o Redis do docker-compose: os worktrees o compartilham. As conferências com o Redis fora do ar usam um container descartável próprio, removido no fim.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Issue, worktree, branch e roadmap | ⬜ |
| 2 | Linha de base | ⬜ |
| 3 | Outbox dona da inbox | ⬜ |
| 4 | `redis/` com as conexões por papel | ⬜ |
| 5 | Health das duas conexões | ⬜ |
| 6 | `RuntimeModule` | ⬜ |
| 7 | Rate limit fora do `AppModule` | ⬜ |
| 8 | `AppModule` em blocos | ⬜ |
| 9 | Superfície pública no dependency-cruiser | ⬜ |
| 10 | ADR 0017 e documentação | ⬜ |
| 11 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: issue, worktree, branch e roadmap

1. A issue é a #68, aberta em 2026-11-27 (`gh issue view 68`). Os commits levam `(#68)` no fim.
2. Crie o worktree a partir da `main`, com a branch `refactor/infra-do-shared`, e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), acrescente a issue na onda 5, trilha M, marcada como 🟡, sem dependência. Na tabela "Arquivos em comum", uma linha para `src/shared/infra/`, `src/app.module.ts` e as páginas do passo 10.
4. Commit: `docs(plan): começa a organização da infra do shared (#68)`. Confira o formato em `.github/CONTRIBUTING.md`.

**Aceite:**

- `git -C <worktree> branch --show-current` mostra `refactor/infra-do-shared`;
- o roadmap mostra a linha 🟡, e o `npm run docs:check` passa.

### Passo 2: linha de base

Sem mudar código. O resultado entra na descrição do PR e serve de comparação no passo 11.

1. No worktree: `npm run ci`, `npm run test:int` e, com o `start:dev` do worktree parado, `npm run test:e2e`. Anote os testes que falham antes de qualquer mudança. Se algum falhar, pare e leve ao dono.
2. Guarde, num rascunho fora do repositório:
   - a saída de `grep -rhoE "from '#shared/infra/[^']+'" src/modules plop-templates | sort | uniq -c`;
   - o corpo do `GET /health/ready` com a app no ar;
   - os logs do desligamento: suba a app com `npm run build && node dist/main.js` e mande `SIGTERM` ao processo.
3. Sem commit.

**Aceite:**

- os três comandos passam, ou as falhas de antes estão anotadas e o dono foi avisado;
- o rascunho tem os três registros do item 2.

### Passo 3: outbox dona da inbox

1. Em `outbox/outbox.module.ts`: `@Global()`, `TypeOrmModule.forFeature([OutboxMessageOrmEntity, ProcessedEventOrmEntity])` no `imports` (ao lado do `MessagingModule`), e os providers `Outbox` (`TypeOrmOutbox`), `ProcessedEvents` (`TypeOrmProcessedEvents`) e `IdempotentConsumer` (a mesma factory de hoje). `exports: [Outbox, IdempotentConsumer]`. Um comentário de uma linha: o módulo liga a outbox e a inbox, e o transporte vem do `MessagingModule`.
2. Em `database/database.module.ts`: tire o `forFeature`, os três providers, o export e os imports de `../outbox/` e do `IdempotentConsumer`. `exports: [TransactionManager]`.
3. `npm run typecheck`, `npm run lint`, `npm run arch`, `npm test`, `npm run test:int -- outbox idempotent-consumer` e `npm run test:e2e -- outbox`.
4. Commit: `refactor(shared): a outbox liga a própria inbox, e o database deixa de conhecê-la (#68)`.

**Aceite:**

- `grep -rn "outbox\|ProcessedEvent\|IdempotentConsumer" src/shared/infra/database/` não acha nada;
- o `OutboxModule` é o único lugar de `src/` que faz `provide: Outbox`, `provide: ProcessedEvents` ou `provide: IdempotentConsumer` (`grep -rn "provide: \(Outbox\|ProcessedEvents\|IdempotentConsumer\)" src`);
- os comandos do item 3 passam.

### Passo 4: `redis/` com as conexões por papel

1. `git mv src/shared/infra/messaging/bullmq-connection.ts src/shared/infra/redis/queue-redis.connection.ts` e `git mv src/shared/infra/cache/redis.connection.ts src/shared/infra/redis/cache-redis.connection.ts`. Renomeie as classes (`QueueRedisConnection`, `CacheRedisConnection`) e, na da fila, os campos (`producer` → `commands`, `worker` → `blocking`), com os comentários ajustados ao papel. O nome no log de erro passa a ser `{ connection: 'commands' | 'blocking' }`, e a mensagem vira `queue redis connection error`.
2. `git mv src/shared/infra/cache/redis.module.ts src/shared/infra/redis/redis.module.ts`: `@Global()`, `providers` e `exports` com as duas classes, e um comentário dizendo por que é global (ordem do desligamento).
3. Atualize quem usa:
   - `messaging/`: `bullmq-publisher.ts`, `event-workers.ts`, `queue-metrics.ts`, `messaging.module.ts` (sai o `BullMqConnection` dos `providers` e dos `exports`; o `MessagingModule` passa a exportar só o `EventPublisher`) e `transport-failure.ts` (o parâmetro `producerStatus` vira `commandsStatus`), com os testes deles;
   - `jobs/scheduled-job.processor.ts` e os processors de `identity` e `orders`, que passam a injetar `QueueRedisConnection` de `#shared/infra/redis/queue-redis.connection`;
   - `cache/cache.module.ts`: injeta `CacheRedisConnection` e tira o `RedisModule` dos dois `imports`, porque ele é global;
   - `health/redis-health.indicator.ts`: injeta `CacheRedisConnection` (o passo 5 acrescenta a fila);
   - `src/app.module.ts`: a factory do throttler injeta `QueueRedisConnection` e usa `connection.commands`. Sai o `imports: [MessagingModule]` do `forRootAsync`, e o `RedisModule` entra na lista de imports;
   - os int-specs: `outbox-redis-down`, `messaging`, `redis-throttler-storage`, `expire-pending-orders.processor` e `cached-order.queries`.
4. Tire o `MessagingModule` do `imports` do `IdentityModule` e do `OrdersModule`, e o import do arquivo.
5. `npm run typecheck`, `npm run lint`, `npm run arch`, `npm test`, `npm run test:int` e `npm run test:e2e`.
6. Commit: `refactor(shared): conexões do Redis em redis/, com nome de papel (#68)`.

**Aceite:**

- `grep -rn "BullMqConnection\|\bRedisConnection\b\|cache/redis\.\|messaging/bullmq-connection\|\.producer\b" src test plop-templates` não acha nada;
- `grep -rln "new Redis\|createClient" src --include='*.ts'` só acha arquivos de `src/shared/infra/redis/`, fora os testes;
- `grep -rn "MessagingModule" src/modules src/app.module.ts` não acha nada;
- `src/shared/infra/cache/` tem só o `cache.module.ts`;
- os comandos do item 5 passam, inclusive o `shutdown`, o `throttle` e o `outbox` do e2e.

### Passo 5: health das duas conexões

1. `RedisHealthIndicator.pingCheck(key: string, connection: 'cache' | 'queue')`: injeta as duas conexões e faz `PING` no `client` do cache ou no `commands` da fila. O comentário sobre o limite de 1 s continua.
2. O `redis-health.indicator.ts` fica em `health/`: o health é uma capacidade e só usa as conexões.
3. `HealthController.ready`: dois checks, `redis-cache` e `redis-queue`, no lugar do `redis`. Atualize o comentário do método.
4. `test/health.e2e-spec.ts`: o fake responde por conexão (`redisUp` vira `{ cache: true, queue: true }`). Um caso por conexão fora: 503, com a chave dela `down` e a outra `up`. O caso do banco continua.
5. `cached-order.queries.int-spec.ts`: ajuste a chamada do `pingCheck`.
6. `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:int -- cached-order`, `npm run test:e2e -- health` e `npm run openapi:check`.
7. Commit: `feat(health): o readiness confere as duas conexões do Redis (#68)`.

**Aceite:**

- com a app no ar, `GET /health/ready` responde 200 com `info.database`, `info.redis-cache` e `info.redis-queue`;
- o e2e do health cobre cada conexão fora, com 503 e só a chave dela `down`;
- o `openapi:check` passa sem gerar o `openapi.json` de novo. Se ele mudar, pare e leve ao dono.

### Passo 6: `RuntimeModule`

1. `git mv src/shared/infra/clock/clock.module.ts src/shared/infra/runtime/runtime.module.ts`, `git mv src/shared/infra/clock/system-clock.ts src/shared/infra/runtime/system-clock.ts` e `git mv src/shared/infra/ids/uuid-v7.generator.ts src/shared/infra/runtime/uuid-v7.generator.ts`. `RuntimeModule`, `@Global`, com `Clock` e `IdGenerator`.
2. Tire `{ provide: IdGenerator, useClass: UuidV7Generator }` e o import do `UuidV7Generator` de `catalog.module.ts`, `identity.module.ts`, `inventory.module.ts`, `orders.module.ts` e `plop-templates/module/module.hbs`. Os `inject: [..., IdGenerator]` continuam.
3. `src/app.module.ts`: `RuntimeModule` no lugar do `ClockModule`. Atualize os imports dos int-specs que usam `UuidV7Generator` ou `SystemClock`.
4. Confira o template: `npm run plop module rascunho`, depois `npm run typecheck`, `npm run lint` e `npm run arch`. Descarte o que o gerador criou. Confira com `git status` e restaure só os caminhos que ele tocou (`git restore <arquivos>` e `git clean -fd src/modules/rascunho`, e o que mais o `git status` listar).
5. `npm run typecheck`, `npm run lint`, `npm run arch`, `npm test`, `npm run test:int` e `npm run test:e2e`.
6. Commit: `refactor(shared): Clock e IdGenerator num RuntimeModule global (#68)`.

**Aceite:**

- `grep -rn "provide: IdGenerator\|provide: Clock" src plop-templates` só acha o `runtime.module.ts`;
- `grep -rln "UuidV7Generator" src/modules plop-templates` só acha testes;
- as pastas `clock/` e `ids/` não existem mais;
- o módulo gerado pelo plop passou no `typecheck`, no `lint` e no `arch` antes de ser descartado, e o `git status` ficou limpo depois.

### Passo 7: rate limit fora do `AppModule`

1. `git mv` de `redis-throttler-storage.ts`, `throttler.guard.ts` e `throttle-by-account.decorator.ts`, com os testes, de `src/shared/infra/http/` para `src/shared/infra/http/rate-limit/`. Ajuste os imports relativos e os aliases que apontam para eles (`src/modules/identity`, `src/app.module.ts` e os testes).
2. `http/rate-limit/rate-limit.options.ts`: `export const rateLimitOptions` com o `inject` (`ConfigService`, `QueueRedisConnection`, `Logger`) e o `useFactory` que hoje está no `AppModule`, com o comentário dos contadores no Redis. Tipe pelo tipo do `forRootAsync` do `@nestjs/throttler`, sem `as`.
3. `src/app.module.ts`: `ThrottlerModule.forRootAsync(rateLimitOptions)`. O `{ provide: APP_GUARD, useClass: AppThrottlerGuard }` continua no `providers`. Saem os imports de `seconds`, `accountThrottlers`, `RedisThrottlerStorage`, `QueueRedisConnection` e `Logger`.
4. `npm run typecheck`, `npm run lint`, `npm run arch`, `npm test`, `npm run test:int -- redis-throttler-storage` e `npm run test:e2e -- throttle auth`.
5. Commit: `refactor(http): opções do rate limit em http/rate-limit/ (#68)`.

**Aceite:**

- o `src/app.module.ts` não tem `useFactory` e não importa nada de `#shared/infra/redis/` nem o `Logger`;
- o `AppThrottlerGuard` continua registrado no `AppModule`;
- o `throttle` e o `auth` do e2e passam sem mudar nenhuma asserção.

### Passo 8: `AppModule` em blocos

1. Reordene o `imports` do `AppModule` nos blocos da tabela de decisões, com uma linha de comentário por bloco. A do bloco de fundação diz que ele sobe primeiro e, por ser global, desliga por último. O `ConfigModule.forRoot` continua inline.
2. Suba a app (`npm run build && node dist/main.js`), mande `SIGTERM` e compare os logs com os do passo 2.
3. `npm run typecheck`, `npm run lint` e `npm run test:e2e`.
4. Commit: `refactor(shared): AppModule com a infra em blocos comentados (#68)`.

**Aceite:**

- o `imports` segue os cinco blocos, nesta ordem;
- o desligamento termina sem travar, os logs têm as mesmas linhas do passo 2 (só mudam os nomes das conexões), e o `test:e2e -- shutdown` passa;
- o `npm run test:e2e` passa inteiro.

### Passo 9: superfície pública no dependency-cruiser

1. Rode `grep -rhoE "from '#shared/infra/[^']+'" src/modules plop-templates | sort -u` fora dos testes. O resultado esperado é a lista inicial abaixo. Se aparecer outro arquivo, leve ao dono antes de incluí-lo.
   - `auth/current-user.decorator`, `auth/public.decorator`, `auth/roles.decorator`;
   - `config/env.validation`, `config/load-env-files`;
   - `database/postgres-options`, `database/run-seed`, `database/transaction-context`;
   - `http/error-status.registry`, `http/page.response`, `http/pagination.query`, `http/problem-details.response`, `http/trim.decorator`, `http/rate-limit/throttle-by-account.decorator`;
   - `jobs/scheduled-job.processor`, `redis/queue-redis.connection`;
   - `messaging/integration-event-handler.decorator`;
   - `resilience/retry`, `resilience/with-timeout`.
2. No `.dependency-cruiser.js`, a regra `shared-infra-so-pela-superficie`: `from` `^src/modules/`, `to` `^src/shared/infra/`, e `pathNot` com a lista (uma regex por arquivo, ancorada em `^src/shared/infra/` e terminada em `\\.ts$`). O `comment` diz o que a regra barra, que um `*.module.ts` ou um adapter do shared entram pelo Nest (`@Global` ou `imports`) e não por import de arquivo, e que acrescentar um arquivo à lista pede o ok na revisão. Aponta para o `camadas.md`.
3. Conferência: num arquivo de produção de um módulo, importe `#shared/infra/database/typeorm-transaction-manager`. Rode `npm run arch`, que deve falhar com o `comment` da regra, e desfaça o import.
4. `npm run arch` e `npm run lint`.
5. Commit: `build(arch): módulos importam só a superfície pública da infra do shared (#68)`.

**Aceite:**

- o `npm run arch` passa sem a conferência e falha com ela, mostrando o `comment`;
- o template do plop gera só imports da lista (confira o `module.hbs` e os outros `.hbs` com `grep "#shared/infra"`);
- a lista da regra é igual à do item 1.

### Passo 10: ADR 0017 e documentação

1. Confira no `docs/adr/` e no roadmap se o 0017 ainda está livre. Crie `docs/adr/0017-infra-do-shared-em-pastas-de-conexao-e-de-capacidade.md`, no formato da 0016. O conteúdo: a regra das pastas, as conexões do Redis por papel (com os nomes que mudaram em relação às ADRs 0015 e 0016), a outbox como dona da inbox, o `RuntimeModule` e a superfície pública. Em `## Considered Options`: o agregador `SharedInfraModule.forRoot`, os barrel files, a fixture de teste e a adoção do `@nestjs/outbox` agora, cada um com o motivo da recusa. Em `## Consequences`: o que custa acrescentar algo à infra e o que a separação das instâncias do Redis passa a mudar.
2. `docs/reference/camadas.md`, seção do shared: a regra das pastas e uma tabela "onde fica" com cada pasta de `src/shared/infra/`, o tipo e o que guarda. A superfície pública, com link para a regra do dependency-cruiser.
3. `docs/explanation/redis.md`: as conexões por papel (`CacheRedisConnection.client`, `QueueRedisConnection.commands` e `blocking`), quem usa cada uma, e o health das duas.
4. `docs/reference/operacao.md`: as chaves do `/health/ready`, o caminho do rate limit e a tabela de [Desligamento](../reference/operacao.md#desligamento), com os nomes novos e a ordem conferida no passo 8.
5. `docs/reference/outbox-e-filas.md` e `docs/explanation/entrega-de-eventos.md`: o `OutboxModule` como dono da inbox e os nomes novos das conexões.
6. `docs/reference/evolucoes-com-gatilho.md`: a linha da separação das instâncias passa a dizer que a mudança fica no `cache-redis.connection.ts`, numa variável nova e no health. A linha do `@nestjs/outbox` passa a dizer que a troca se limita ao `src/shared/infra/outbox/`.
7. `docs/how-to/agendar-um-job.md` e `docs/how-to/criar-um-modulo.md`: o `QueueRedisConnection` no processor e o módulo sem a linha do `IdGenerator`.
8. Varredura: `grep -rn "BullMqConnection\|RedisConnection\b\|ClockModule\|uuid-v7\|ids/\|clock/\|\.producer\b\|cache/redis\|http/redis-throttler\|http/throttler\|http/throttle-by-account" docs AGENTS.md .github` e corrija cada ocorrência fora das ADRs 0001 a 0016.
9. `docs/README.md`: a ADR 0017 no índice. No `AGENTS.md`, a rota "Criar entidade, caso de uso, repositório ou outra classe…" já leva ao `camadas.md`; confira se a rota do Redis e a da outbox continuam certas.
10. `npm run docs:check`.
11. Commit: `docs(shared): ADR 0017 e páginas da infra do shared (#68)`.

**Aceite:**

- a varredura do item 8 só acha as ADRs 0001 a 0016 e este plano;
- o `camadas.md` responde, para cada pasta de `src/shared/infra/`, se ela é de conexão, de fundação, de capacidade ou de biblioteca;
- o `npm run docs:check` passa.

### Passo 11: verificação, revisão, registro e PR

1. `npm run ci`, `npm run test:int` e, com o `start:dev` do worktree parado, `npm run test:e2e`. Compare com a linha de base do passo 2: nenhum teste que passava pode falhar.
2. Conferência manual com um Redis descartável numa porta livre (`docker run -d --name infra-shared-redis -p 6391:6379 redis:8`) e a app sobre ele (`REDIS_URL=redis://127.0.0.1:6391 node dist/main.js`):
   - com o Redis no ar, `GET /health/ready` responde 200 com as duas chaves `up`;
   - depois de `docker stop infra-shared-redis`, responde 503 com as duas `down`, e a app continua no ar;
   - depois de `docker start infra-shared-redis`, volta a 200 em poucos segundos, e um cadastro (`POST /v1/auth/register`) chega ao Mailpit;
   - por fim, `SIGTERM` na app e `docker rm -f infra-shared-redis`.
3. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar código, repita os itens 1 e 2.
4. Faça rebase sobre a `main` e rode `npm run ci` de novo. Se outra trilha tiver entrado com a ADR 0017, renumere a desta e os links.
5. Com o ok do dono, faça push e abra o PR com o título `refactor(shared): infra do shared em pastas de conexão e de capacidade (#68)`. A descrição traz:
   - a árvore de `src/shared/infra/` antes e depois;
   - a troca das chaves do `/health/ready` (`redis` → `redis-cache` e `redis-queue`);
   - as mudanças em relação à proposta (início deste plano) e o que ficou em [Fora do plano](#fora-do-plano);
   - a linha de base do passo 2 e a conferência do item 2.
6. Com o ok do dono, deixe na issue um comentário de registro com este plano e os mesmos pontos da descrição.
7. Último commit da branch, `docs(plan): fecha o plano da organização da infra do shared (#68)`:
   - apague este plano;
   - no roadmap, marque a issue como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, tire o plano de "Em andamento" e acrescente a linha com o link do comentário da issue, como as das outras;
   - rode `npm run docs:check` de novo e faça push.

**Aceite:**

- o CI do PR passa;
- todos os critérios de pronto do início deste plano estão conferidos, um por linha, na descrição do PR;
- o `/simplify` e o `/code-review` rodaram, e os achados ou foram corrigidos ou estão justificados no PR.
