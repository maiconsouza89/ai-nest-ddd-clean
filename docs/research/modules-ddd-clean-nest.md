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

Movida. Que teste cobre cada camada, e com o quê, está em [Testes](../reference/testes.md). A divisão entre `tsc`, ESLint, Prettier e dependency-cruiser está no [ADR 0004](../adr/0004-lint-e-formatacao.md), e os comandos em [Comandos](../reference/comandos.md#verificação). As regras de arquitetura ficam no `.dependency-cruiser.js`, cada uma com o comentário que o `npm run arch` imprime, e o que nenhuma regra confere está em [Camadas](../reference/camadas.md). O porquê do tracing, do trace que atravessa a outbox e dos logs ligados a ele está em [Observabilidade](../explanation/observabilidade.md).

## Operação

Movida. A configuração HTTP, o Swagger, o health check, o rate limit, os logs de acesso e a ordem de desligamento estão em [Operação](../reference/operacao.md). O que muda ao extrair um módulo para um serviço está em [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md#extrair-um-módulo-para-um-serviço).

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
