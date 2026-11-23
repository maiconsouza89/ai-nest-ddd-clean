# Guia: módulos com DDD e Clean Architecture no NestJS

Nov 20, 2026 · @Maicon Souza da Silva

## Visão geral

Movida para [Arquitetura](../explanation/arquitetura.md): o que torna o sistema um monólito modular, a regra de dependência e o Nest só na infra.

## Estrutura de pastas

Movida para [Camadas](../reference/camadas.md#estrutura-de-pastas).

## Camadas

Movida. As regras de cada camada estão em [Camadas](../reference/camadas.md), e o porquê, com exemplos do orders, em [Arquitetura](../explanation/arquitetura.md).

## Persistência com TypeORM

Movida. O porquê da entidade de domínio separada da ORM entity está em [Persistência](../explanation/persistencia.md), e as regras das ORM entities em [Convenções](../reference/convencoes.md#typeorm).

## Módulos independentes

Movida. O porquê está em [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md#cada-módulo-tem-schema-e-migrations-próprios), as regras em [Camadas](../reference/camadas.md#entre-módulos), e o passo a passo de uma migration em [Como gerar uma migration](../how-to/gerar-uma-migration.md).

## Itens comuns entre módulos (shared kernel)

Movida. O que vai para o `shared` está em [Camadas](../reference/camadas.md#shared), e o porquê em [Shared kernel](../explanation/shared-kernel.md).

## Autenticação e ownership

Movida. O porquê está em [Autenticação e ownership](../explanation/autenticacao.md), e as rotas, prazos e respostas em [Autenticação](../reference/autenticacao.md).

## Agregados e comunicação entre módulos

Movida para [Agregados](../explanation/agregados.md): o que fica no agregado `Order`, o estoque pelo port `StockGateway` e a reserva síncrona dentro da transação do pedido.

## Dependências e contratos entre módulos

Movida. O porquê da dependência numa direção só, da facade que devolve resultado e da versão dos contratos está em [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md). As regras dos contratos estão em [Camadas](../reference/camadas.md#contracts), e as da versão da API HTTP, em [Convenções](../reference/convencoes.md#versionamento-da-api-http).

## Transações, concorrência e eventos

Movida. O porquê da transação pelo contexto, da concorrência otimista, da outbox, da fila por consumidor e do consumidor idempotente está em [Consistência e eventos](../explanation/consistencia-e-eventos.md), e o passo a passo de um evento novo em [Como publicar um evento de integração](../how-to/publicar-um-evento-de-integracao.md).

## Paginação

Movida para [Como paginar uma listagem](../how-to/paginar-uma-listagem.md): o `PaginationQuery`, a query com `findAndCount` ou com `GROUP BY`, o desempate pelo `id` e o cursor para listas grandes.

## Modelagem do domínio

Movida para [Modelagem do domínio](../explanation/modelagem-do-dominio.md): o dinheiro em centavos, o `Clock` e o `IdGenerator`, os erros com `code`, a validação em mais de um lugar, o domain service, a exclusão como estado e a auditoria. Onde fica cada peça e cada validação está em [Camadas](../reference/camadas.md#domain).

## Infra: configuração, jobs, cache e serviços externos

Movida. Os passos estão em [Como adicionar uma variável de ambiente](../how-to/adicionar-uma-variavel-de-ambiente.md), [Como agendar um job](../how-to/agendar-um-job.md), [Como cachear uma leitura](../how-to/cachear-uma-leitura.md) e [Como criar um seed](../how-to/criar-um-seed.md). O porquê do Redis, do cache por geração e do agendador do BullMQ está em [Redis](../explanation/redis.md), e o dos ports, do timeout e do retry nas chamadas a fornecedores, em [Serviços externos](../explanation/servicos-externos.md). As variáveis estão em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md).

## Qualidade

### Testes por camada

| Camada | Tipo | Como |
| --- | --- | --- |
| Domain | Unitário | Puro, sem mocks |
| Casos de uso | Unitário | Repositórios em memória |
| Repositórios e mappers | Integração | Postgres real com Testcontainers e migrations aplicadas |
| Contratos entre módulos | Contrato | Exemplos versionados de eventos e chamadas da facade, validados por quem publica e por quem consome |
| Fluxos críticos | E2E | Poucos, via HTTP |

```ts
it('não paga duas vezes', () => {
  const order = makeOrder();
  order.pay();
  expect(() => order.pay()).toThrow(OrderAlreadyPaidError);
});
```

O runner é o Vitest, com três projetos no `vitest.config.ts`: `unit` (`*.spec.ts`), `int` (`*.int-spec.ts`) e `e2e` (`test/*.e2e-spec.ts`). A decorator metadata, sem a qual o Nest não injeta por classe, vem do oxc, o transformador padrão do Vite 8, que lê `emitDecoratorMetadata` do `tsconfig.json`. O suporte é parcial: tipos que exigem inferência (type alias, utility types) viram `Object`, então injete sempre por classe ou `@Inject`. Os testes importam `describe`, `it`, `expect` e `vi` de `'vitest'`, sem `globals`. O `src/shared/testing/decorator-metadata.spec.ts` falha se a metadata deixar de ser emitida.

Na integração, o módulo `@testcontainers/postgresql` sobe um Postgres descartável por execução. Rode as migrations reais nele antes dos testes, assim elas também são testadas. Cache e filas usam o `@testcontainers/redis` do mesmo jeito.

### Lint e formatação

Quatro ferramentas, cada uma com uma responsabilidade e nenhuma sobreposta:

| Ferramenta | Responsável por |
| --- | --- |
| `tsc --noEmit` | tipos |
| dependency-cruiser | fronteiras entre módulos e camadas |
| ESLint + `typescript-eslint` | bugs que compilam: promises, `any` inseguro, código morto |
| Prettier | formatação |

O Prettier fica com `singleQuote` e `printWidth: 100`, e a versão é fixada sem `^`, porque até um patch pode mudar a formatação. O ESLint usa `recommendedTypeChecked` com `projectService` (flat config), mais algumas regras do `strictTypeChecked` escolhidas uma a uma (lista na ADR 0004), e o `eslint-config-prettier`, que só desliga as regras de estilo. Não use `consistent-type-imports`: com `emitDecoratorMetadata`, um `import type` numa classe injetada pelo construtor quebra a injeção do Nest em tempo de execução. As fronteiras entre módulos ficam só no dependency-cruiser. Detalhes e regras desligadas: ADR 0004.

`npm run ci` roda typecheck, lint, `format:check`, testes unitários e arch.

### Regras de arquitetura no CI

Com `dependency-cruiser`, rodando `npm run arch` (`depcruise src --output-type err-long`) no pipeline. Se alguém quebrar a regra, o build falha.

As regras ficam no `.dependency-cruiser.js`, e o `comment` de cada uma, impresso junto com a violação, diz o que ela barra. O que nenhuma regra confere está em [Camadas](../reference/camadas.md).

Mantenha `tsPreCompilationDeps: 'specify'`: sem ele, um `import type` de `infra` dentro de `domain` passa despercebido, e com `'specify'` o import só de tipo ganha o rótulo `type-only`, que a `no-circular` usa. Com os aliases `#...`, o `enhancedResolveOptions.conditionNames` precisa incluir `@app/source`. Sem ele, os aliases resolvem para o `dist/`, e as regras deixam de enxergar esses imports sem avisar ([ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md)).

A exceção da `modulos-so-via-contracts` é o arquivo do módulo Nest, que importa o módulo Nest do outro para declarar a dependência em `imports`. Os `exports` de um `@Module` são a API pública dele: importar o `CatalogModule` só expõe a `CatalogFacade`. Por isso os módulos de negócio não são `@Global` (só a infraestrutura do `shared` é, ver o [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md)).

Sem `severity: 'error'`, a violação vira só aviso e o build não falha.

### Observabilidade

- **Tracing distribuído:** OpenTelemetry com auto-instrumentação para Node. Ele propaga o contexto no padrão W3C (`traceparent`) entre serviços e dispensa um correlation id feito à mão.
  - O `main.ts` importa só o `tracing.ts` e depois carrega o app por `import()` dinâmico (`bootstrap.ts`). A auto-instrumentação só enxerga módulos carregados depois dela.
  - No ESM, o `require` não é interceptado. O `tracing.ts` registra o hook `@opentelemetry/instrumentation/hook.mjs` com `module.register` antes de iniciar o SDK. Sem ele, o que o código importa direto (como o `ioredis`) e o `express` ficam sem spans, e nada falha nem avisa. Um `import` estático do app no `main.ts` seria resolvido antes do hook e teria o mesmo efeito. Uma regra de lint (`no-restricted-imports` em `src/main.ts`) barra esse import estático.
  - No Node 26, o `module.register` imprime `DEP0205` na subida. É o caminho que a doc do OpenTelemetry indica hoje; a alternativa é o `register-hooks.mjs` do `import-in-the-middle`, que usa `module.registerHooks`.
  - No Nest 12, não há spans da camada Nest (controllers e handlers): o `@opentelemetry/instrumentation-nestjs-core` só suporta o Nest até a versão 11. Os spans de http, express, pg, ioredis e pino continuam, e isso basta para seguir uma requisição.
- **Logs ligados ao trace:** o id do trace vai em todo log. A outbox copia o `traceparent` (que carrega esse id) para os metadados de cada evento, e o consumidor continua o mesmo trace (`runInEventTrace`). Assim dá para seguir uma requisição por todos os módulos. A instrumentação do pino grava os campos `trace_id` e `span_id`, e não `traceId`. Para mudar o nome, use a opção `logKeys`.
- **Logs estruturados:** JSON com `nestjs-pino`.
- **Na application:** se precisar logar, use um port `Logger`, sem importar o Nest.

## Operação

### Swagger

Decorators do `@nestjs/swagger` só nos DTOs HTTP e controllers. Uma tag por recurso (`@ApiTags('orders')`, `@ApiTags('auth')`). O plugin da CLI do Nest infere boa parte dos tipos e reduz decorators.

Por padrão, o plugin só lê arquivos `.dto.ts` e `.entity.ts`. Como aqui os DTOs HTTP se chamam `*.request.ts`, `*.requests.ts` e `*.query.ts`, configure o `dtoFileNameSuffix` no `nest-cli.json`. Sem isso, essas classes ficam sem schema. O plugin roda só no `nest build`/`nest start`, e não nos testes.

```json
"plugins": [{ "name": "@nestjs/swagger", "options": { "dtoFileNameSuffix": [".request.ts", ".requests.ts", ".query.ts"] } }]
```

### Health, rate limit e segurança básica

| Item | Ferramenta | Observação |
| --- | --- | --- |
| Health check | `@nestjs/terminus` | Separe liveness (processo vivo) de readiness (banco com `pingCheck` e Redis com `PING`). Indicadores próprios usam o `HealthIndicatorService`, porque o Nest 12 removeu a API antiga (`HealthIndicator` e `HealthCheckError`). Marque as rotas de health com `@SkipThrottle()`, senão as sondas do orquestrador contam no rate limit |
| Desligamento gracioso | `app.enableShutdownHooks()` | Termina requisições e jobs em andamento e fecha conexões antes de o processo sair |
| Rate limit | `@nestjs/throttler` | Guard global via `APP_GUARD`, limite mais rígido em login. O storage padrão é em memória: com várias instâncias, use storage compartilhado (Redis), com incremento e expiração atômicos. O `@nest-lab/throttler-storage-redis` 1.2.0 declara suporte só até o Nest 11 (novembro de 2026); no Nest 12, um `ThrottlerStorage` próprio é pequeno. Atrás de proxy, configure `trust proxy` |
| Headers de segurança | `helmet` | `app.use(helmet())` no `configureApp` (`app.setup.ts`) |
| CORS | `app.enableCors()` | Só origens conhecidas |
| Entrada HTTP | `ValidationPipe` global | `whitelist`, `forbidNonWhitelisted` e `transform` ativos |

### Extrair um módulo para microsserviço

Como o módulo já é isolado, a extração muda só a infra:

1. O módulo ganha deploy próprio, e o schema dele vai para um banco separado.
2. Nos módulos que usam a facade, o adapter troca a chamada em memória por um cliente HTTP ou gRPC, implementando o mesmo port.
3. Os eventos passam do barramento em memória para um broker. Com outbox, só muda o publicador.
4. O serviço novo valida o JWT sozinho, com chave compartilhada ou JWKS.

Domain e application não mudam. É o retorno de todo o isolamento feito antes.

## Pragmatismo e checklist

### Nem todo módulo precisa de DDD

Se o módulo só valida campos (categorias, configurações, cadastros simples), use controller, service e repositório TypeORM, ainda dentro da pasta do módulo e respeitando o isolamento. Quando surgir regra de negócio, evolua para a estrutura completa.

### Gerador de módulos

Com Plop, `npx plop module <nome>` cria toda a estrutura padrão com os nomes certos. O `plopfile.mjs` é ESM, e os templates ficam em `plop-templates/module/`. Os templates geram código ESM (imports relativos com `.js`, aliases `#shared/*` e `import.meta.dirname`), e o plopfile cria os scripts `mig:<nome>:*` com `typeorm-ts-node-esm` e a condição `@app/source`.

```js
// plopfile.mjs (resumido)
// [template, destino relativo à pasta do módulo]; os templates são planos, um por arquivo gerado
const FILES = [
  ['entity.hbs', 'domain/entities/{{kebabCase name}}.entity.ts'],
  ['module.hbs', 'infra/{{kebabCase name}}.module.ts'],
  ['migration-schema.hbs', 'infra/database/typeorm/migrations/{{timestamp}}-create-{{kebabCase name}}-schema.ts'],
  // ...
];

export default function (plop) {
  plop.setGenerator('module', {
    prompts: [{ type: 'input', name: 'name', validate: (v) => /* kebab-case */ true }],
    actions: (data) => {
      const kebab = plop.getHelper('kebabCase')(data.name);
      const dir = `src/modules/${kebab}`;
      if (existsSync(dir)) throw new Error(`${dir} já existe`);
      data.timestamp = Date.now(); // o da migration do schema vem antes do da tabela
      return [
        ...FILES.map(([t, dest]) => ({ type: 'add', path: `${dir}/${dest}`, templateFile: `plop-templates/module/${t}` })),
        // + dois `modify` que registram o módulo no app.module.ts, uma checagem de que o registro
        //   casou (o `modify` não avisa) e uma função que grava os scripts mig:<nome> no package.json
      ];
    },
  });
}
```

### Checklist de um módulo novo

#### Arquitetura

- [ ] domain e application sem imports de `@nestjs/*` ou `typeorm`
- [ ] Repositórios e ports como `abstract class`; casos de uso registrados com `useFactory`
- [ ] Comunicação com outros módulos só por `contracts/` (facade e eventos)
- [ ] Grafo de módulos sem ciclos e sem `forwardRef`
- [ ] Nada de negócio no `shared`
- [ ] Regras do `dependency-cruiser` com `severity: 'error'` passando no CI

#### Domínio

- [ ] Entidades com `create` (regras) e `restore` (reconstrução)
- [ ] Validação em três níveis: DTO, entidade e caso de uso
- [ ] Valores monetários com `Money`; preços calculados no servidor, nunca recebidos do cliente
- [ ] Ownership verificado no caso de uso e filtro de dono nas queries
- [ ] Erros de domínio mapeados no exception filter

#### Persistência

- [ ] `@nestjs/typeorm` 12 (Nest 12) com TypeORM 1.x
- [ ] ORM entities separadas, com mapper e `orphanedRowAction: 'delete'` nos filhos
- [ ] Repositórios usando o `EntityManager` da transação ativa
- [ ] Schema próprio, DataSource da CLI, migrations revisadas e `synchronize: false`
- [ ] Nenhuma FK, join ou transação com outros módulos
- [ ] Optimistic locking ou update atômico onde há disputa
- [ ] Listagens paginadas com `limit` máximo

#### Eventos e integração

- [ ] Eventos com `eventId`, `type` e `version`, payload só com primitivos
- [ ] Outbox com `SKIP LOCKED`, retry e fila de mensagens mortas
- [ ] Handlers idempotentes por constraint `UNIQUE`
- [ ] Com filas: outbox antes da fila, uma fila por consumidor e `jobId` determinístico
- [ ] Cache só na leitura, com TTL, invalidação por evento e leitura direta do banco se o cache falhar
- [ ] Chamadas externas com timeout; retry só em operações idempotentes

#### Operação

- [ ] Variáveis de ambiente validadas na subida
- [ ] `.env.example` versionado, `.env` fora do Git
- [ ] Rotas públicas versionadas (`/v1`), com aviso antes de remover versões
- [ ] `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`
- [ ] Guard de autenticação global, `helmet` e rate limit com storage compartilhado
- [ ] Jobs e workers só chamam casos de uso; cron sem duplicar entre instâncias
- [ ] Health check com liveness e readiness, e desligamento gracioso
- [ ] Redis das filas com `maxmemory-policy noeviction` e AOF
- [ ] Testes de domínio, casos de uso, integração e contratos

## Referências

Fontes consultadas na revisão de novembro de 2026.

### Documentação oficial

- [NestJS: Custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS: Circular dependency](https://docs.nestjs.com/fundamentals/circular-dependency)
- [NestJS: Guards](https://docs.nestjs.com/guards)
- [NestJS: Authentication](https://docs.nestjs.com/security/authentication)
- [NestJS: Validation](https://docs.nestjs.com/techniques/validation)
- [NestJS: Configuration](https://docs.nestjs.com/techniques/configuration)
- [NestJS: Versioning](https://docs.nestjs.com/techniques/versioning)
- [NestJS: Database (TypeORM)](https://docs.nestjs.com/techniques/sql)
- [NestJS: Task scheduling](https://docs.nestjs.com/techniques/task-scheduling)
- [NestJS: Health checks (Terminus)](https://docs.nestjs.com/recipes/terminus)
- [NestJS: Rate limiting](https://docs.nestjs.com/security/rate-limiting)
- [TypeORM: Entities](https://typeorm.io/docs/entity/entities)
- [TypeORM: Migrations setup](https://typeorm.io/docs/migrations/setup)
- [TypeORM: Generating migrations](https://typeorm.io/docs/migrations/generating)
- [TypeORM: Upgrading from 0.3 to 1.0](https://typeorm.io/docs/releases/1.0/upgrading-from-0.3/)
- [TypeORM 1.0 is here](https://typeorm.io/blog/typeorm-1-0)
- [nestjs-cls: Transactional plugin](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)
- [nestjs-cls: TypeORM adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/typeorm-adapter)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
- [dependency-cruiser: rules tutorial](https://raw.githubusercontent.com/sverweij/dependency-cruiser/HEAD/doc/rules-tutorial.md)
- [Testcontainers for Node.js: PostgreSQL](https://node.testcontainers.org/modules/postgresql/)
- [Testcontainers for Node.js: Redis](https://node.testcontainers.org/modules/redis/)
- [NestJS: Caching](https://docs.nestjs.com/data/caching)
- [NestJS: Queues](https://docs.nestjs.com/application/queues)
- [NestJS: Migration guide v11 (cache-manager e Keyv)](https://docs.nestjs.com/v11/migration-guide)
- [BullMQ: Job Ids](https://docs.bullmq.io/guide/jobs/job-ids)
- [BullMQ: Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ: Going to production](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ: Job Schedulers](https://docs.bullmq.io/guide/job-schedulers/)
- [BullMQ: Repeatable (legado)](https://docs.bullmq.io/guide/jobs/repeatable)
- [OpenTelemetry JS: Propagation](https://opentelemetry.io/docs/languages/js/propagation/)
- [pg-types (node-postgres)](https://www.npmjs.com/package/pg-types)

### Padrões e especificações

- [Robert C. Martin: The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Vaughn Vernon: Effective Aggregate Design, parte II](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf)
- [Kamil Grzybek: Modular Monolith with DDD](https://github.com/kgrzybek/modular-monolith-with-ddd)
- [Chris Richardson: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox)
- [Martin Fowler: CQRS](https://www.martinfowler.com/bliki/CQRS.html)
- [Martin Fowler: Quantity e Money](https://www.martinfowler.com/eaaDev/Quantity.html)
- [Markus Winand: No offset (keyset pagination)](https://use-the-index-luke.com/no-offset)
- [RFC 9562: UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html)
- [IETF draft: The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
