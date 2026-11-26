---
type: reference
---

# Camadas

O que fica em cada camada de um módulo e em qual pasta. Os imports entre camadas são conferidos pelo `npm run arch` (`.dependency-cruiser.js`), e a forma dos contratos (`abstract class`, nunca `interface` nem `type` com método) pelo `npm run lint` (`eslint.config.mjs`). Quando uma regra falha, a mensagem diz o que ela barra e como consertar. Esta página reúne o que nenhuma ferramenta confere.

## Mapa

| Camada | Pasta | Papel |
| --- | --- | --- |
| Domain | `domain/` | Regras de negócio |
| Application | `application/` | Orquestra o domínio e declara o que precisa de fora |
| Infra | `infra/` | Liga tudo ao Nest, ao banco, às filas e ao HTTP |
| Contracts | `contracts/` | API pública do módulo para os outros |

Exceções:

- Um módulo CRUD sem regra de negócio dispensa as camadas, como o [catalog](modules/catalog.md#estrutura). As regras de fronteira entre módulos continuam valendo para ele.
- O [inventory](modules/inventory.md) não tem entidade de domínio. O repositório é organizado por operações (`registerReservation`, `decrease`, `increase`...), e as invariantes ficam no banco: o `CHECK` de saldo não negativo, o `UNIQUE` da referência da reserva e o update condicional da baixa ([Transações e concorrência](../explanation/transacoes-e-concorrencia.md)).

## Estrutura de pastas

O orders tem todas as camadas. A infra é organizada por tipo e depois por tecnologia. Um arquivo de exemplo por pasta:

```text
src/
├── modules/
│   ├── catalog/                         # CRUD, sem camadas
│   ├── identity/
│   ├── inventory/
│   ├── notifications/                   # sem domain/: só reage a eventos
│   └── orders/
│       ├── domain/
│       │   ├── entities/                order.entity.ts, order-item.entity.ts
│       │   ├── value-objects/           order-status.vo.ts
│       │   ├── events/                  order-paid.event.ts (evento de domínio)
│       │   ├── errors/                  order-already-paid.error.ts
│       │   └── repositories/            order.repository.ts
│       ├── application/
│       │   ├── order-access.ts          (helper usado por vários casos de uso)
│       │   ├── use-cases/               create-order.use-case.ts
│       │   ├── queries/                 order.queries.ts
│       │   ├── ports/                   price-catalog.ts, stock-gateway.ts
│       │   ├── dtos/                    create-order.input.ts
│       │   └── events/                  to-integration-event.ts
│       ├── infra/
│       │   ├── database/
│       │   │   ├── typeorm/             typeorm-order.repository.ts, typeorm-order.mapper.ts,
│       │   │   │   │                    orders.data-source.ts
│       │   │   │   ├── entities/        order.orm-entity.ts
│       │   │   │   └── migrations/
│       │   │   └── in-memory/           in-memory-order.repository.ts
│       │   ├── gateways/                catalog-price.adapter.ts, inventory-stock.gateway.ts
│       │   ├── http/
│       │   │   ├── controllers/         orders.controller.ts
│       │   │   ├── dtos/                create-order.request.ts
│       │   │   └── error-statuses.ts    (status HTTP de cada código de erro)
│       │   ├── cache/                   cached-order.queries.ts
│       │   ├── events/                  invalidate-order-list-cache.handler.ts
│       │   ├── jobs/                    expire-pending-orders.processor.ts
│       │   └── orders.module.ts
│       └── contracts/
│           └── events/                  order-paid.event.ts (OrderPaidV1), order-paid.v1.example.ts
└── shared/
    ├── domain/                          aggregate-root.ts, domain-event.ts, domain-error.ts,
    │                                    concurrency.error.ts, money.vo.ts (com os erros do Money)
    ├── application/                     actor.ts, page.ts, integration-event.ts, idempotent-consumer.ts
    │   └── ports/                       clock.ts, id-generator.ts, transaction-manager.ts, logger.ts,
    │                                    actor-resolver.ts, outbox.ts, event-publisher.ts,
    │                                    processed-events.ts
    ├── infra/                           auth/, database/, outbox/, messaging/, cache/, config/, ...
    └── testing/                         decorator-metadata.spec.ts (a injeção por classe funciona nos testes)
```

## Domain

| Peça | Pasta | Convenção |
| --- | --- | --- |
| Entidade | `domain/entities/` | `create` aplica as regras de criação e registra o evento de domínio. `restore` só reconstrói o estado salvo, sem validar nem registrar evento, e só a persistência o chama |
| Invariante | entidade ou value object | Validada no domínio mesmo que o DTO já valide |
| Value object | `domain/value-objects/<nome>.vo.ts` | Imutável. Quando tem regra, valida na criação (`Email.create`). Um conjunto fixo de valores é um objeto `as const` com o tipo derivado (`OrderStatus`) |
| Evento de domínio | `domain/events/` | A raiz registra (`addDomainEvent`) e não publica. Sai pela outbox quando o caso de uso salva o agregado |
| Erro | `domain/errors/` | Subclasse de `DomainError` com um `code` próprio |
| Contrato de repositório | `domain/repositories/` | Um por agregado: salva a raiz e os filhos juntos. Não pagina nem filtra para tela: isso é query |
| Domain service | `domain/services/` | Só para regra que envolve mais de um agregado e não cabe em nenhum. Recebe dados prontos e não usa repositório |

## Application

| Peça | Pasta | Convenção |
| --- | --- | --- |
| Caso de uso | `application/use-cases/` | Uma classe com `execute`. Carrega pelo repositório, chama o domínio e salva. Grava o agregado e a outbox dentro de `TransactionManager.run` |
| Validação que depende de dados | caso de uso | E-mail único, estoque disponível: consulta o repositório ou um port. Unicidade também tem `UNIQUE` no banco |
| Ownership | caso de uso ou entidade | Recebe o `Actor` na entrada e decide se ele pode agir sobre o recurso. Role simples por rota é guard na infra |
| Query | `application/queries/` | Leitura que devolve um DTO pronto, sem montar agregado. A paginação e o filtro pelo ator (`listByCustomer(actor.id, page)`) ficam aqui, e não num filtro depois de carregar tudo |
| Port | `application/ports/` | O que a application precisa de fora (preço, estoque, e-mail, pagamento, logger). A implementação é um adapter na infra |
| DTO de entrada | `application/dtos/` | Tipo simples, montado pelo controller a partir do DTO HTTP |
| Evento de integração | `application/events/` | Converte o evento de domínio no evento de `contracts/events/` e o grava na outbox, na mesma transação do agregado |
| Configuração | construtor | O caso de uso recebe valores prontos (prazo, tamanho de lote) e não lê variável de ambiente |
| Helper de vários casos de uso | raiz de `application/` | Uma regra ou um passo repetido por mais de um caso de uso, como `orders/application/order-access.ts` (carregar o pedido e conferir o acesso) e `identity/application/session-issuer.ts` (emitir o par de tokens) |

## Infra

| Peça | Pasta | Convenção |
| --- | --- | --- |
| Módulo Nest | `infra/<módulo>.module.ts` | Liga cada contrato à implementação. Caso de uso e adapter sem `@Injectable()` entram por `useFactory`, com o `inject` na ordem dos parâmetros. Um adapter com `@Injectable()`, como um repositório TypeORM ou uma facade, entra por `useClass`. Lê o `ConfigService` e passa valores ao caso de uso |
| Nest module auxiliar | `infra/<nome>.module.ts` | Um segundo Nest module, quando o módulo liga um port do `shared` que não deve sair pelo Nest module principal. O `identity/infra/identity-auth.module.ts` liga o `ActorResolver` do shared, e o `AppModule` só o repassa para o `AuthModule.forRoot` |
| Controller | `infra/http/controllers/` | Converte o DTO HTTP no DTO da application e repassa o `Actor` como dado |
| DTO HTTP | `infra/http/dtos/` | `class-validator` e Swagger ficam aqui. Valida o formato da entrada |
| Mapa de status | `infra/http/error-statuses.ts` | `<MÓDULO>_ERROR_STATUSES`: o status HTTP de cada `code` do módulo, registrado nos `providers` do Nest module com `provideErrorStatuses(...)`. O módulo não monta resposta de erro: o filtro global do `shared` monta ([Respostas de erro](respostas-de-erro.md)) |
| Job | `infra/jobs/` | Estende o `ScheduledJobProcessor` do `shared` e chama um caso de uso no `run()` |
| Handler de evento | `infra/events/` | Marcado com `@IntegrationEventHandler`, recebe um evento de `contracts/events/` e chama um caso de uso pelo `IdempotentConsumer`. Um efeito idempotente por natureza, como trocar a geração do cache, dispensa o `IdempotentConsumer` |
| Persistência | `infra/database/typeorm/` | ORM entities em `entities/`, repositório concreto, mapper e DataSource da CLI. O mapper converte nos dois sentidos |
| Transação | repositório concreto | Repositório que grava usa o `EntityManager` da transação ativa (`currentManager`). `@InjectRepository` só em leitura fora de caso de uso |
| Fake de teste | `infra/database/in-memory/` | Repositório em memória para os testes unitários dos casos de uso |
| Adapter | `infra/adapters/`, `infra/gateways/` | Implementa um port. Traduz o erro do fornecedor, ou o resultado da facade de outro módulo, para um erro do módulo |
| Cache | `infra/cache/` | Envolve a implementação de uma query e é ligado no módulo Nest no lugar dela |

## Contracts

| Peça | Pasta | Convenção |
| --- | --- | --- |
| [Facade](glossario.md#facade) | `contracts/<nome>.facade.ts` | Devolve um resultado (`{ ok: false, reason }`) em vez de lançar o erro do domínio. Um método novo entra sem mudar a assinatura dos existentes |
| [Evento de integração](glossario.md#evento-de-integração) | `contracts/events/<nome>.event.ts` | Tipo `<Nome>V<n>`, com `version: <n>` e payload só com primitivos. Um campo opcional novo fica na mesma versão. Renomear, remover ou mudar o tipo de um campo publica a `V<n+1>` junto com a anterior, até todos os consumidores migrarem |

## Entre módulos

Os imports entre módulos são conferidos pelo `npm run arch` (só o `contracts/`, sem ciclo). A exceção é o arquivo do Nest module (`*.module.ts`), que pode importar também o Nest module de outro módulo, para declarar a dependência em `imports` (regra `modulo-nest-so-importa-modulo-nest` do `.dependency-cruiser.js`). O `npm run arch` roda `depcruise src` e não olha o `test/`: a fronteira do `test/` só é conferida no code review, e os e2e importam `../src/app.module.js`. O resto:

| Situação | Convenção |
| --- | --- |
| Schema | Um por módulo: `@Entity({ name, schema: '<módulo>' })`. A primeira migration só faz o `CREATE SCHEMA` |
| Migrations | DataSource da CLI por módulo (`<módulo>.data-source.ts`), só com as entidades do módulo e `migrationsTableName: '<módulo>_migrations'`. A CLI não passa pelo Nest: o DataSource carrega e valida o `.env` (`loadEnvFiles` e `validateEnv`) e usa a `postgresOptions(env, { migrations: true })`, sem os timeouts de query |
| Referência a dado de outro módulo | Só o id (`customerId`), sem FK |
| Leitura de dado de outro módulo | Pela facade, ou por uma cópia local atualizada por eventos. Sem join |
| Mudança que precisa refletir em outro módulo | Evento de integração pela outbox. Sem transação entre módulos, exceto a reserva de estoque do orders ([Agregados](../explanation/agregados.md#síncrono-dentro-da-transação-do-pedido)) |
| Dependência nos dois sentidos | Uma direção pela facade, a volta por evento |

## Checklist

O que nenhum check confere num módulo novo ou alterado:

| Regra | Ver |
| --- | --- |
| O `create` da entidade aplica as regras, e o `restore` só reconstrói | [Domain](#domain) |
| Valor em dinheiro usa o `Money`, e o preço vem do servidor, nunca da requisição | [Modelagem do domínio](../explanation/modelagem-do-dominio.md) |
| Um recurso com dono: o controller passa o `@CurrentUser()`, o caso de uso confere o dono e a query filtra pelo ator | [Autenticação e ownership](../explanation/autenticacao.md) |
| Os filhos do agregado são salvos pela raiz | [Convenções](convencoes.md#typeorm) |
| Uma gravação disputada usa a versão do repositório gerado ou um update condicional | [Transações e concorrência](../explanation/transacoes-e-concorrencia.md) |
| Nenhuma FK, join ou transação com tabela de outro módulo | [Entre módulos](#entre-módulos) |
| Toda listagem é paginada, com limite máximo | [Convenções](convencoes.md#paginação) |
| Cada evento publicado tem teste de contrato | [Testes](testes.md#por-camada) |
| Consumidor de evento, cache, job e chamada a fornecedor seguem a página de cada um | [Como publicar um evento de integração](../how-to/publicar-um-evento-de-integracao.md), [Como cachear uma leitura](../how-to/cachear-uma-leitura.md), [Como agendar um job](../how-to/agendar-um-job.md), [Serviços externos](../explanation/servicos-externos.md) |

## Shared

O `src/shared/` segue as mesmas camadas e guarda só blocos técnicos com a mesma regra em todo módulo.

| Vai para o `shared` | Fica no módulo |
| --- | --- |
| Domínio: `AggregateRoot`, `DomainEvent`, `DomainError`, `ConcurrencyError` e `Money`. Os erros do `Money` (`InvalidMoneyError`, `CurrencyMismatchError`) ficam dentro do `money.vo.ts`, e não numa pasta `domain/errors/` | Conceito de negócio (`Customer`, `Product`) |
| Aplicação: `Actor`, `Page`, `IntegrationEvent` e `IdempotentConsumer` | Erro de domínio de um módulo, em `domain/errors/` |
| Ports técnicos: `Clock`, `IdGenerator`, `TransactionManager`, `Logger`, `ActorResolver`, `Outbox`, `EventPublisher` e `ProcessedEvents` | Value object usado por um módulo só, mesmo que pareça genérico (o `Email` do identity) |
| Infra comum: auth, outbox, filas, cache, banco, configuração e o filtro das respostas de erro | Repositórios, entidades e o mapa de status dos códigos de erro de cada módulo |

Na dúvida, o tipo fica duplicado em cada módulo, e não no `shared`. O porquê está em [Shared kernel](../explanation/shared-kernel.md).
