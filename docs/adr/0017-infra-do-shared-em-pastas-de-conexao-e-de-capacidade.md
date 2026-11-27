---
status: accepted
---

# Infra do shared em pastas de conexão e de capacidade

Em `src/shared/infra/`, a pasta de um arquivo não dizia de quem ele era. O Redis estava em três lugares: o cliente do cache em `cache/`, mas usado também pelo health, e as conexões do BullMQ em `messaging/`, mas usadas também pelo rate limit e pelos jobs. Por isso o `identity` e o `orders` importavam o `MessagingModule` inteiro só para os jobs receberem a conexão. A outbox estava dividida entre `database/`, que registrava as entities e ligava `Outbox`, `ProcessedEvents` e `IdempotentConsumer`, e `outbox/`, que ficava só com o relay. O `IdGenerator` era ligado em cada módulo de negócio, enquanto o `Clock` tinha módulo global. A factory do rate limit ficava inline no `AppModule`. E nada separava o que um módulo podia importar do `shared/infra` do que era detalhe dele.

Cada pasta de `src/shared/infra/` passa a ter um tipo, e o tipo diz o que ela pode fazer:

- **Conexão** (`database/`, `redis/`): cria os clientes e cuida do ciclo de vida deles. Não tem regra.
- **Capacidade** (`cache/`, `messaging/`, `outbox/`, `jobs/`, `http/rate-limit/`, `auth/`, `health/`): recebe conexões por injeção e nunca chama `createClient` nem `new Redis`.
- **Fundação** (`config/`, `observability/`, `runtime/`): portas e serviços que todo módulo usa.
- **Biblioteca** (`resilience/` e o resto de `http/`): funções e decorators sem módulo Nest.

As peças que mudaram de lugar:

- **Conexões do Redis por papel:** `redis/redis.module.ts`, global, exporta a `QueueRedisConnection` (antes `BullMqConnection`) e a `CacheRedisConnection` (antes `RedisConnection`). Os campos da conexão das filas trocam de nome: `producer` vira `commands` (quem enfileira, o rate limit e o health), e `worker` vira `blocking` (os workers do BullMQ). Os nomes antigos eram do vocabulário do BullMQ, mas o rate limit e o health também usam a conexão. As ADRs [0015](0015-outbox-e-filas-por-consumidor.md) e [0016](0016-falha-de-transporte-nao-mata-evento-da-outbox.md) citam os nomes antigos e não são editadas. O `RedisModule` continua global pela ordem do desligamento: os módulos `@Global` rodam cada hook por último, e o `beforeApplicationShutdown` da conexão do cache precisa rodar depois do atraso do Terminus.
- **Readiness das duas conexões:** o `/health/ready` troca a chave `redis` por `redis-cache` e `redis-queue`, com `PING` no `client` do cache e no `commands` das filas.
- **Outbox dona da inbox:** o `OutboxModule`, global, registra as duas entities e liga `Outbox`, `ProcessedEvents` e `IdempotentConsumer`, além do relay, do worker e das métricas. O `DatabaseModule` fica com o `TypeOrmModule.forRootAsync` e o `TransactionManager`. É o recorte do `@nestjs/outbox`: outbox e inbox numa store, transporte à parte.
- **`RuntimeModule`:** global, liga `Clock` e `IdGenerator`. Substitui o `ClockModule` e o `{ provide: IdGenerator, ... }` de cada módulo e do template do plop.
- **Rate limit:** o guard, o storage, o `@ThrottleByAccount` e as opções do `ThrottlerModule.forRootAsync` ficam em `http/rate-limit/`. O `AppModule` só repassa as opções.
- **`AppModule` em blocos:** a infra fica solta no `imports`, em blocos comentados: fundação, conexões, capacidades, HTTP e negócio.
- **Superfície pública:** a regra `shared-infra-so-pela-superficie` do `.dependency-cruiser.js` deixa um módulo importar de `src/shared/infra/` só os arquivos de uma lista. Um `*.module.ts` ou um adapter do shared entra pelo Nest.

A regra das pastas, a tabela de cada pasta e a superfície pública estão em [Camadas](../reference/camadas.md#pastas-da-infra-do-shared).

## Considered Options

- **Um módulo agregador (`SharedInfraModule.forRoot`):** o `AppModule` importaria um módulo só. Recusado: a ordem dos imports e o `@Global` decidem a ordem dos hooks de desligamento, e o agregador a esconderia. Os exemplos da documentação do Nest listam a infra solta no `AppModule`, com comentários.
- **Barrel files (`index.ts`) como superfície pública:** recusado. A documentação do Nest avisa que um barrel de módulos e providers causa dependência circular. A superfície é uma regra do dependency-cruiser.
- **Uma fixture de teste que monta a infra:** recusada. O dependency-cruiser já exclui os testes, e os testes de integração montam adapters reais de propósito.
- **Adotar o `@nestjs/outbox` agora:** recusado. O pacote está abaixo da 1.0, e a troca continua em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md). Juntar a outbox e a inbox no `OutboxModule` reduz a troca a uma pasta.
- **Subpastas `http/errors/` e `http/pagination/`:** recusadas. Só o rate limit ganha pasta própria, porque é uma capacidade sobre o Redis. O resto do `http/` são peças soltas da borda HTTP, e a mudança seria só cosmética.

## Consequences

- Acrescentar algo à infra começa por escolher o tipo da pasta. Um uso novo do Redis ou do Postgres é uma capacidade que injeta a conexão existente, e não cria cliente. Um arquivo novo que os módulos precisem importar entra na lista da regra do dependency-cruiser, com o ok na revisão.
- Os módulos de negócio não importam o `MessagingModule` nem ligam o `IdGenerator`: recebem a conexão das filas e as portas de runtime dos módulos globais.
- Separar o Redis em duas instâncias em produção passa a mudar só a `CacheRedisConnection`, uma variável nova e o health, que já confere cada conexão com uma chave própria.
- Quem lê o `/health/ready` pela chave `redis` precisa ler `redis-cache` e `redis-queue`. O orquestrador lê só o status HTTP, e o schema no OpenAPI é o genérico do Terminus, sem as chaves.
- Mais dois módulos `@Global` (`RedisModule`, que antes só o cache importava, e `RuntimeModule`), e o `OutboxModule` passa a ser global. A [ADR 0003](0003-imports-explicitos-entre-modulos.md) reserva o `@Global` à infraestrutura do shared, e os três são.
