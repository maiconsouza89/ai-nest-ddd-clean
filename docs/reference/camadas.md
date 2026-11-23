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

Exceção: um módulo CRUD sem regra de negócio dispensa as camadas, como o [catalog](modules/catalog.md#estrutura). As regras de fronteira entre módulos continuam valendo para ele.

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
| Query | `application/queries/` | Leitura que devolve um DTO pronto, sem montar agregado. A paginação fica aqui |
| Port | `application/ports/` | O que a application precisa de fora (preço, estoque, e-mail, pagamento, logger). A implementação é um adapter na infra |
| DTO de entrada | `application/dtos/` | Tipo simples, montado pelo controller a partir do DTO HTTP |
| Evento de integração | `application/events/` | Converte o evento de domínio no evento de `contracts/events/` e o grava na outbox, na mesma transação do agregado |
| Configuração | construtor | O caso de uso recebe valores prontos (prazo, tamanho de lote) e não lê variável de ambiente |

## Infra

| Peça | Pasta | Convenção |
| --- | --- | --- |
| Módulo Nest | `infra/<módulo>.module.ts` | Liga cada contrato à implementação. Caso de uso e adapter sem `@Injectable()` entram por `useFactory`, com o `inject` na ordem dos parâmetros. Lê o `ConfigService` e passa valores ao caso de uso |
| Controller | `infra/http/controllers/` | Converte o DTO HTTP no DTO da application e repassa o `Actor` como dado |
| DTO HTTP | `infra/http/dtos/` | `class-validator` e Swagger ficam aqui. Valida o formato da entrada |
| Filter | `infra/http/filters/domain-error.filter.ts` | Um por módulo, com uma tabela de `code` para status HTTP |
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
| [Evento de integração](glossario.md#evento-de-integração) | `contracts/events/<nome>.event.ts` | Tipo `<Nome>V<n>` |

## Shared

O `src/shared/` segue as mesmas camadas e guarda só blocos técnicos com a mesma regra em todo módulo.

| Vai para o `shared` | Fica no módulo |
| --- | --- |
| `AggregateRoot`, `DomainError`, `Money`, `Actor`, `Page` | Conceito de negócio (`Customer`, `Product`) |
| Ports técnicos: `Clock`, `IdGenerator`, `TransactionManager`, `Logger` | Value object usado por um módulo só, mesmo que pareça genérico (o `Email` do identity) |
| Infra comum: auth, outbox, filas, cache, banco, configuração | Repositórios, entidades e o filter de erros de cada módulo |

Na dúvida, o tipo fica duplicado em cada módulo, e não no `shared`.
