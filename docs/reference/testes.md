---
type: reference
---

# Testes

Que tipo de teste cobre cada parte do código, onde ele fica e com o que roda. Os comandos para rodar estão em [Comandos](comandos.md#testes).

## Runner

O runner é o Vitest ([ADR 0001](../adr/0001-vitest-e-esm.md)), sem globals: os testes importam `describe`, `it`, `expect` e `vi` de `'vitest'`. O `test/setup-env.ts` preenche as variáveis mínimas e desliga workers, jobs, throttle, logs e tracing ([Variáveis de ambiente](variaveis-de-ambiente.md#testes)). Os testes que precisam de um deles o ligam por conta própria.

A decorator metadata que o Nest usa para injetar por classe vem do oxc, o transformador padrão do Vite. O oxc emite `Object` para tipos que exigem inferência (type alias, utility types). Se um construtor falhar com "can't resolve dependencies" nos testes, confira o tipo do parâmetro. O `src/shared/testing/decorator-metadata.spec.ts` falha se a metadata deixar de ser emitida.

## Por camada

| O que se testa | Tipo | Arquivo | Com o quê | Exemplo |
| --- | --- | --- | --- | --- |
| Entidade e value object | Unitário | `*.spec.ts` ao lado do arquivo | Nada além da classe: sem fakes nem mocks | `order.entity.spec.ts`, `money.vo.spec.ts` |
| Caso de uso | Unitário | `*.spec.ts` ao lado do arquivo | Repositório em memória (`infra/database/in-memory/`) e fakes de `#test/fakes` para os outros ports | `create-order.use-case.spec.ts` |
| Adapter, gateway, guard, handler de evento, decorator de cache | Unitário | `*.spec.ts` ao lado do arquivo | Fakes do port que ele chama | `resilient-payment.gateway.spec.ts`, `on-order-paid.handler.spec.ts` |
| Repositório, query, transação, idempotência no Postgres | Integração | `*.int-spec.ts` ao lado do arquivo, em geral em `infra/database/typeorm/` | Postgres descartável com as migrations reais do módulo | `typeorm-order.repository.int-spec.ts`, `transaction.int-spec.ts` |
| Cache, filas, jobs agendados e rate limit no Redis | Integração | `*.int-spec.ts` ao lado do arquivo | Redis descartável | `cached-order.queries.int-spec.ts`, `expire-pending-orders.processor.int-spec.ts` |
| Evento de integração, lado de quem publica | Contrato (unitário) | `application/events/to-integration-event.contract.spec.ts` | O evento gerado a partir do agregado, comparado com o exemplo `contracts/events/*.v<N>.example.ts` | `orders` |
| Evento de integração, lado de quem consome | Contrato (unitário) | O spec do handler | O mesmo exemplo do contrato como entrada, inclusive entregue duas vezes | `on-order-cancelled.handler.spec.ts` |
| Fluxo crítico pela API | E2E | `test/*.e2e-spec.ts` | O `AppModule` inteiro, contra o Postgres e o Redis do `docker-compose.yml` | `orders.e2e-spec.ts`, `outbox.e2e-spec.ts` |

As facades não têm teste de contrato: o `npm run typecheck` confere a assinatura dos dois lados.

## Apoio aos testes

Os arquivos de `test/fakes/` e `test/helpers/` que não são óbvios pelo nome explicam no topo o que fazem. Os que pedem atenção:

| Onde | O que tem |
| --- | --- |
| `test/fakes/` | Um fake por port, para os unitários |
| `test/helpers/<módulo>-database.ts` | As entidades e a lista de migrations de cada módulo, para o `startDatabase`. O helper não lê a pasta de migrations: uma migration nova entra na lista ([Como gerar uma migration](../how-to/gerar-uma-migration.md)) |
| `test/helpers/redis.ts` | `startRedis`, com a política de memória do `docker-compose.yml` ([Redis](../explanation/redis.md#uma-instância-para-filas-e-cache-só-em-desenvolvimento)) |
| `test/helpers/contract.ts` | `incompatibilities(exemplo, real)`: lista os campos do exemplo que faltam ou mudaram de tipo, em qualquer profundidade. Campo a mais é aceito (mudança aditiva) |

## Convenções

| Convenção | Detalhe |
| --- | --- |
| Um container por arquivo de integração | Cada `*.int-spec.ts` sobe o seu no `beforeAll` e o derruba no `afterAll` |
| Imports nos testes | Os specs ficam fora do `npm run arch`, então a convenção de imports depende de revisão ([Convenções](convencoes.md#relativos-e-aliases)) |
| Lint nos testes | Algumas regras com tipos ficam desligadas. Quais e por quê: [ADR 0004](../adr/0004-lint-e-formatacao.md#regras-desligadas-na-adoção) |
