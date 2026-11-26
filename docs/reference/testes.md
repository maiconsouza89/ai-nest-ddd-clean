---
type: reference
---

# Testes

Que tipo de teste cobre cada parte do código, onde ele fica e com o que roda. Os comandos para rodar estão em [Comandos](comandos.md#testes), e o porquê da cobertura e do isolamento dos testes em [Estratégia de testes](../explanation/estrategia-de-testes.md).

## Runner

O runner é o Vitest ([ADR 0001](../adr/0001-vitest-e-esm.md)), sem globals: os testes importam `describe`, `it`, `expect` e `vi` de `'vitest'`. O `test/setup-env.ts` preenche as variáveis mínimas e desliga workers, jobs, throttle, logs e tracing ([Variáveis de ambiente](variaveis-de-ambiente.md#testes)). Os testes que precisam de um deles o ligam por conta própria.

A decorator metadata que o Nest usa para injetar por classe vem do oxc, o transformador padrão do Vite. O oxc emite `Object` para tipos que exigem inferência (type alias, utility types). Se um construtor falhar com "can't resolve dependencies" nos testes, confira o tipo do parâmetro. O `src/shared/testing/decorator-metadata.spec.ts` falha se a metadata deixar de ser emitida.

## Por camada

| O que se testa | Tipo | Arquivo | Com o quê | Exemplo |
| --- | --- | --- | --- | --- |
| Entidade e value object | Unitário | `*.spec.ts` ao lado do arquivo | Nada além da classe: sem fakes nem mocks | `order.entity.spec.ts`, `money.vo.spec.ts` |
| Caso de uso | Unitário | `*.spec.ts` ao lado do arquivo | Repositório em memória (`infra/database/in-memory/`) e fakes de `#test/fakes` para os outros ports | `create-order.use-case.spec.ts` |
| Adapter, gateway, guard, handler de evento, decorator de cache | Unitário | `*.spec.ts` ao lado do arquivo | Fakes do port que ele chama | `resilient-payment.gateway.spec.ts`, `on-order-paid.handler.spec.ts` |
| Repositório, query, transação, idempotência no Postgres | Integração | `*.int-spec.ts` ao lado do arquivo, em geral em `infra/database/typeorm/` | Um banco só do arquivo, com as migrations reais do módulo ([Convenções](#convenções)) | `typeorm-order.repository.int-spec.ts`, `transaction.int-spec.ts` |
| Cache, filas, jobs agendados e rate limit no Redis | Integração | `*.int-spec.ts` ao lado do arquivo | Um banco lógico do Redis só do worker ([Convenções](#convenções)) | `cached-order.queries.int-spec.ts`, `expire-pending-orders.processor.int-spec.ts` |
| Evento de integração, lado de quem publica | Contrato (unitário) | `application/events/to-integration-event.contract.spec.ts` | O evento gerado a partir do agregado, comparado com o exemplo `contracts/events/*.v<N>.example.ts` | `orders`, `identity` |
| Evento de integração, lado de quem consome | Contrato (unitário) | O spec do handler | O mesmo exemplo do contrato como entrada, inclusive entregue duas vezes | `on-order-cancelled.handler.spec.ts` |
| Adapter de fornecedor real | Integração | `*.int-spec.ts` ao lado do adapter | O serviço num `GenericContainer` do Testcontainers | `smtp-email-sender.int-spec.ts`, com o Mailpit |
| Fluxo crítico pela API | E2E | `test/*.e2e-spec.ts` | O `AppModule` inteiro, contra o Postgres, o Redis e o Mailpit do `docker-compose.yml`, no banco e no banco lógico do checkout (num worktree, os do slot dele) | `auth.e2e-spec.ts`, `outbox.e2e-spec.ts` |

As facades não têm teste de contrato: o `npm run typecheck` confere a assinatura dos dois lados.

## Apoio aos testes

Os arquivos de `test/fakes/` e `test/helpers/` que não são óbvios pelo nome explicam no topo o que fazem. Os que pedem atenção:

| Onde | O que tem |
| --- | --- |
| `test/fakes/` | Um fake por port, para os unitários |
| `test/global-setup/int.ts` | O `globalSetup` do projeto `int`: sobe o Postgres e o Redis da execução, monta um template por `test/helpers/<módulo>-database.ts` (achados por glob) e passa as URLs aos testes por `provide`/`inject` |
| `test/helpers/<módulo>-database.ts` | O conjunto do módulo (`ModuleDatabase`: nome do template, entidades e lista de migrations) e o `start<Módulo>Database`, que devolve `{ ds, stop }` sobre um banco clonado do template. O helper não lê a pasta de migrations: uma migration nova entra na lista ([Como gerar uma migration](../how-to/gerar-uma-migration.md)) |
| `test/helpers/redis.ts` | `startRedis` devolve a URL do banco lógico do worker, já limpo. `startRedisContainer` sobe um container só do arquivo, com a política de memória do `docker-compose.yml` ([Redis](../explanation/redis.md#uma-instância-para-filas-e-cache-só-em-desenvolvimento)) |
| `test/helpers/tcp-proxy.ts` | `startTcpProxy` põe um proxy TCP em processo na frente de um container: `close()` derruba as conexões e `open()` volta a escutar na mesma porta. Substitui o `restart()` do Testcontainers, que pode trocar a porta mapeada |
| `test/helpers/auth.ts` | `registerUser` só cadastra. `registerAndLogin` cadastra, verifica o e-mail com o código que chega ao Mailpit e faz login. O código sai por evento, então o arquivo de e2e que o usa importa o `test/helpers/enable-outbox-worker.ts` antes do `AppModule` |
| `test/helpers/guard-probe.controller.ts` | `GuardProbeController`: uma rota autenticada (`GET /v1/guard-probe`) e uma só de admin (`POST /v1/guard-probe/admin`), registradas só no `TestingModule` do `auth.e2e-spec.ts`. Os testes do guard e das roles não dependem das rotas dos módulos de exemplo |
| `test/helpers/error-probe.controller.ts` | `ErrorProbeController`: rotas públicas em `/v1/error-probe` que lançam um erro inesperado, um erro de domínio com código registrado só pelo teste (`ERROR_PROBE_STATUSES`), um com código fora do mapa, e uma que valida um corpo com campo aninhado. Registrado só no `TestingModule` do `problem-details.e2e-spec.ts`, junto com `provideErrorStatuses(ERROR_PROBE_STATUSES)` |
| `test/helpers/problem.ts` | `expectProblemJson(res)`: confere o `Content-Type: application/problem+json` de uma resposta de erro |
| `test/helpers/mailpit.ts` | Lê os e-mails pela API do Mailpit: `emailsTo`, `waitForEmail` e `verificationCodeFor`. Com `MAILPIT_TAG` (num worktree), a busca no Mailpit compartilhado filtra pela tag, além do destinatário. Uma API passada pelo teste, como a do Mailpit do Testcontainers, não leva a tag. Os e2e não trocam o `EmailSender` por um fake: o e-mail sai por SMTP, como em produção |
| `test/helpers/contract.ts` | `incompatibilities(exemplo, real)`: lista os campos do exemplo que faltam ou mudaram de tipo, em qualquer profundidade. Campo a mais é aceito (mudança aditiva) |

## Só os testes afetados

Em PR, o CI roda os unitários, os de integração e os e2e com `vitest run --changed <base>` ([Comandos](comandos.md#ci)). Todo e2e importa o `AppModule`, que importa quase todo o `src/`: quase toda mudança em `src/` roda a suíte e2e inteira. Localmente, o mesmo vale com `npx vitest run --project unit --changed main`.

| O `--changed` | Detalhe |
| --- | --- |
| Enxerga | Os arquivos do diff contra a base (`<base>...HEAD`), os modificados e os novos ainda sem commit. Roda cada teste que importa um deles, direta ou indiretamente, por caminho relativo ou por alias `#...` |
| Não enxerga | O que é carregado por glob ou por caminho, e não por import. Exemplo: os data sources carregam as migrations por glob (`migrations/*.{ts,js}`) |
| Não enxerga | Um import usado só como tipo, que some na compilação. Mudar `catalog/contracts/catalog.facade.ts` não roda o `catalog-price.adapter.spec.ts` do orders, que só anota tipos com a `CatalogFacade`. Uma mudança de tipo quebra no `typecheck`, que o job `check` roda no projeto inteiro |
| Roda tudo | Quando o diff tem um arquivo do `forceRerunTriggers` do `vitest.config.ts`, o arquivo do `setupFiles` ou o do `globalSetup` (e o que ele importa, como os helpers de banco) |

## Cobertura

`npm run test:coverage` roda os unitários com a cobertura do `@vitest/coverage-v8`, configurada em `test.coverage` no `vitest.config.ts`. O `npm test` não mede. Cada relatório sai num lugar:

| Relatório | Onde | Para quê |
| --- | --- | --- |
| `text-summary` | Terminal e log do CI | As quatro métricas do total |
| `html` | `coverage/index.html` | Navegar arquivo por arquivo, localmente |
| `json-summary` | `coverage/coverage-summary.json` | A tabela por camada do resumo do job no CI (`scripts/coverage-summary.mjs`) |

A pasta `coverage/` fica no `.gitignore`. Não há relatório `text` por arquivo, nem `lcov` ou `cobertura`. Com um teste falhando, o Vitest não gera relatório.

**O que é medido.** Só os unitários, sobre todo o `src/**/*.ts`: um arquivo sem teste aparece com 0%. A integração e o e2e não entram ([Evoluções com gatilho](evolucoes-com-gatilho.md#ci)). Os arquivos de teste dos três projetos não entram no relatório.

**O que fica fora do relatório** (`coverage.exclude`):

| Padrão | O que é |
| --- | --- |
| `**/migrations/**`, `**/*.data-source.ts`, `**/seeds/**` | Migrations, data sources da CLI do TypeORM e seeds |
| `**/in-memory/**` | Repositórios em memória, só dos testes |
| `src/**/contracts/events/*.example.ts` | Exemplos dos testes de contrato |
| `src/shared/testing/**` | Utilitários dos testes |

O `main.ts`, o `bootstrap.ts`, o `tracing.ts` e os `*.module.ts` ficam no relatório.

**Meta.** Piso de 90% nas quatro métricas (linhas, statements, branches e funções), só nos globs `src/**/domain/**` e `src/**/application/**`. Não há meta global nem `thresholds.autoUpdate`. Um arquivo novo em `domain/` ou `application/` sem teste pode derrubar a cobertura abaixo do piso. O `npm run ci` roda o `test:coverage`, então a falha aparece antes do push.

Um `npm run test:coverage -- <padrão>` falha a meta, porque mede só parte da suíte. Para rodar um arquivo, use `npm test -- <padrão>`.

**Com a integração.** Para medir também a integração, localmente, com Docker no ar:

```sh
npx vitest run --project unit --project int --coverage
```

A meta continua valendo, e o `domain/` sobe um pouco, porque a integração exercita classes de erro que os unitários não alcançam.

**No CI.** A entrada `.nvmrc` do job `unit` roda o `npm run test:coverage`, com a suíte inteira também em PR, e acrescenta ao resumo do job uma tabela por camada (`domain`, `application`, `contracts`, infra e o resto, e o total). Os detalhes estão em [Comandos](comandos.md#ci).

## Convenções

| Convenção | Detalhe |
| --- | --- |
| Um Postgres e um Redis por execução da integração | O `globalSetup` sobe os dois uma vez, e os arquivos rodam em paralelo. O Postgres roda sem durabilidade (`fsync`, `synchronous_commit` e `full_page_writes` desligados, dados em tmpfs) |
| Um banco por arquivo, clonado de template | O `start<Módulo>Database` faz `CREATE DATABASE ... TEMPLATE tpl_<módulo>` no `beforeAll`, e o `stop` o apaga. Um template por conjunto de migrations de cada módulo |
| Um banco lógico do Redis por worker | `redis://host:port/<VITEST_POOL_ID>`, limpo com `FLUSHDB` no `startRedis`. O Redis sobe com `--databases 128`. Os arquivos de um mesmo worker rodam um depois do outro. Um teste que limpa o Redis usa `FLUSHDB`, nunca `FLUSHALL` |
| Container próprio só quando o teste mexe nele | O `cached-order.queries.int-spec.ts` derruba o Redis no meio (`startRedisContainer`), o `outbox-redis-down.int-spec.ts` o derruba e o traz de volta por um proxy (`startTcpProxy`), e o `smtp-email-sender.int-spec.ts` sobe o Mailpit. Um hook que sobe container passa o prazo dele; os outros ficam no `hookTimeout` de 30 s |
| Arquivo carregado por glob ou por caminho | O padrão dele entra no `forceRerunTriggers` do `vitest.config.ts`, começando por `**/` (o Vitest compara com o caminho absoluto), com um comentário dizendo por quê. Sem ele, um PR que muda só esse arquivo passa sem rodar os testes que dependem dele ([Só os testes afetados](#só-os-testes-afetados)) |
| Imports nos testes | Os specs ficam fora do `npm run arch`, então a convenção de imports depende de revisão ([Convenções](convencoes.md#relativos-e-aliases)) |
| Lint nos testes | Algumas regras com tipos ficam desligadas. Quais e por quê: [ADR 0004](../adr/0004-lint-e-formatacao.md#regras-desligadas-na-adoção) |
