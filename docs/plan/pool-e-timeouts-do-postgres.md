# Plano de pool e timeouts da conexão com o Postgres

A conexão com o Postgres recebe só a `url` (`src/shared/infra/database/database.module.ts` e os 5 `*.data-source.ts` da CLI). O `pg` 8.23.1, sem configuração, deixa três esperas sem limite:

- **Fila do pool:** com o pool cheio, quem pede uma conexão espera para sempre (`connectionTimeoutMillis` 0). É o mecanismo do "requisições lentas esgotam o pool e derrubam a API" de [Serviços externos](../explanation/servicos-externos.md#timeout-em-toda-chamada).
- **Query presa:** sem `statement_timeout`, segura a conexão indefinidamente.
- **Transação esquecida aberta:** sem `idle_in_transaction_session_timeout`, segura a conexão e os locks.

O trabalho fecha a issue #18 num PR só, nesta branch (`feat/pool-timeout-ssl-postgres`).

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Variáveis | `DATABASE_POOL_MAX` (padrão `10`, inteiro ≥ 1), `DATABASE_CONNECT_TIMEOUT_MS` (`5000`, ≥ 1), `DATABASE_STATEMENT_TIMEOUT_MS` (`30000`, ≥ 0) e `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS` (`60000`, ≥ 0). Todas opcionais: sem a variável, vale o padrão do projeto, não o do `pg` |
| Para onde vão | `poolSize` e `connectTimeoutMS` do TypeORM (viram `max` e `connectionTimeoutMillis` do pool). Os dois timeouts de query vão no `extra` (`statement_timeout` e `idle_in_transaction_session_timeout`), que o `pg` manda como parâmetros de conexão e o servidor aplica |
| `0` nos timeouts de query | A app não manda o parâmetro (o `pg` só o envia se for diferente de 0), e vale o do servidor ou do role, sem limite por padrão. Serve também para usar atrás do PgBouncer, que recusa parâmetros de conexão que não acompanha |
| Por que estes padrões | Conexão em 5 s: acima do ping de 1 s da readiness. Statement em 30 s: teto contra a query presa, não meta de latência. Transação ociosa em 60 s: bem acima dos ~6 s em que o pagamento segura a transação durante a chamada ao fornecedor. Pool em 10: o padrão do `pg`, ajustável por deploy |
| SSL | Sem variável. Continua só no `sslmode` e no `sslrootcert` da `DATABASE_URL`, como já documenta o [deploy](../how-to/fazer-o-deploy.md#postgres-externo). No `pg`, o que vem da URL vence o `ssl` do config (`connection-parameters.js`: `Object.assign({}, config, parse(connectionString))`), e uma variável seria uma segunda fonte de verdade que perderia sem aviso. A parte de SSL da issue fica atendida pela documentação |
| SSL obrigatório em produção | Não. Quebraria o profile `prod` do compose e os bancos em rede privada |
| Um ponto de configuração | Uma função `postgresOptions` em `src/shared/infra/database/`, usada pelo `DatabaseModule`, pelos 5 data sources e pelo `plop-templates/module/data-source.hbs` |
| Migrations e seeds | Mesmo pool e mesmo timeout de conexão, sem os dois timeouts de query (`postgresOptions(..., { migrations: true })`). Um `CREATE INDEX` ou um backfill que passa no dev com pouco dado não pode ser cancelado no deploy de produção. Os seeds importam o data source das migrations e herdam isso |
| Fora, com gatilho | `lock_timeout` nas migrations (a prática para não travar o tráfego da app esperando lock) e a tradução dos timeouts do banco para 503 com `code` próprio. Os dois vão para [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md) |
| Fora, sem gatilho | `query_timeout` (desiste no cliente e deixa a query rodando no servidor), `lock_timeout` na app (a espera por lock já conta no `statement_timeout`), `idleTimeoutMillis`, `maxLifetimeSeconds`, `min` e `application_name` |
| Resposta HTTP | Sem mudança. Pool cheio (`timeout exceeded when trying to connect`) e statement cancelado (SQLSTATE `57014`) continuam respondendo 500 pelo filtro genérico |
| ADR | Nenhum. O porquê fica em [Persistência](../explanation/persistencia.md) |

## Critérios de aceite

O PR só fica pronto com todos conferidos:

- [ ] Sem nenhuma das quatro variáveis no ambiente, a app e a CLI de migrations sobem com pool 10, conexão em 5 s, statement em 30 s e transação ociosa em 60 s (a app) ou sem os dois timeouts de query (as migrations e os seeds).
- [ ] Valor inválido (negativo, não inteiro, `DATABASE_POOL_MAX=0`, `DATABASE_CONNECT_TIMEOUT_MS=0`) impede a subida com a mensagem da validação. `0` nos dois timeouts de query é aceito.
- [ ] Um teste de integração confere que uma query acima do `statement_timeout` falha com o SQLSTATE `57014` e que a conexão volta ao pool.
- [ ] Um teste de integração confere que uma transação ociosa além do limite tem a sessão encerrada pelo servidor, e que o DataSource segue atendendo.
- [ ] Um teste de integração confere que, com o pool cheio, o pedido de conexão falha dentro do `DATABASE_CONNECT_TIMEOUT_MS`, em vez de ficar pendurado.
- [ ] Nenhum `*.data-source.ts` nem o `DatabaseModule` monta a conexão sem a `postgresOptions`. Um módulo gerado pelo `plop module` já nasce com ela.
- [ ] `npm run ci`, `npm run test:int` e `npm run test:e2e` passam.
- [ ] A documentação do passo 4 está atualizada, e o `docs:check` passa.
- [ ] `/simplify` e `/code-review` rodaram sobre as mudanças (fluxo de entrega do `AGENTS.md`).

## Referências

| Assunto | Fonte | Tipo |
| --- | --- | --- |
| Opções do driver Postgres do TypeORM (`connectTimeoutMS`, `poolSize`, `ssl`, `extra`; a URL perde para as outras opções) | <https://github.com/typeorm/typeorm/blob/master/docs/docs/drivers/postgres.md>, via Context7 | Oficial |
| Como o TypeORM 1.1.3 monta o pool: `extra` por cima de `connectionString`, `ssl`, `connectionTimeoutMillis` e `max` | `node_modules/typeorm/driver/postgres/PostgresDriver.js`, `createPool` | Código instalado |
| Opções do `Client` (`statement_timeout`, `idle_in_transaction_session_timeout`, `query_timeout`, `lock_timeout`) e do `Pool` (`max`, `connectionTimeoutMillis`, `idleTimeoutMillis`) | <https://node-postgres.com/apis/client> e <https://node-postgres.com/apis/pool>, via Context7 | Oficial |
| O `pg` só manda os timeouts diferentes de 0 | `node_modules/pg/lib/client.js`, `getStartupConf` | Código instalado |
| `sslmode` na URL vence o `ssl` do config, e o aviso do `pg` 8 sobre `require`, `prefer` e `verify-ca` | `node_modules/pg/lib/connection-parameters.js` e `node_modules/pg-connection-string/index.js` | Código instalado |
| PgBouncer recusa parâmetros de conexão que não acompanha (`ignore_startup_parameters`) | <https://www.pgbouncer.org/config.html> | Oficial |
| `statement_timeout`, `idle_in_transaction_session_timeout` e o SQLSTATE `57014` | <https://www.postgresql.org/docs/current/runtime-config-client.html> e <https://www.postgresql.org/docs/current/errcodes-appendix.html> | Oficial |

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**. O **Pronto quando** é o critério de aceite do passo.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto: `docs/reference/variaveis-de-ambiente.md`, `docs/how-to/adicionar-uma-variavel-de-ambiente.md`, `docs/reference/testes.md` e `docs/reference/camadas.md`.
- Antes de usar uma API do TypeORM ou do `pg` que o repositório ainda não usa, consulte o Context7, como pede o `AGENTS.md`.
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Push e abertura de PR só com o ok do dono do repositório. O título do PR: `feat(database): pool e timeouts na conexão com o Postgres (#18)`.
- Este plano nasce e morre no mesmo PR: no último passo, ele sai de `docs/plan/` e o registro vai para um comentário da issue #18, como manda o [README da documentação](../README.md).

---

## Fase única: pool e timeouts

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: variáveis e validação
> - [ ] Passo 2: `postgresOptions` em todos os pontos de conexão
> - [ ] Passo 3: testes de integração dos três limites
> - [ ] Passo 4: documentação
> - [ ] Passo 5: entrega

### Passo 1: variáveis e validação

**Por quê:** a app só sobe com variáveis válidas. Um timeout negativo ou um pool 0 tem que barrar a subida, não virar um comportamento estranho do driver.

**Faça:**

- Em `src/shared/infra/config/env.validation.ts`, as quatro variáveis com `@IsInt()`, `@Min(...)` e o padrão na propriedade, como o `SHUTDOWN_GRACE_MS`. Um comentário curto em cada uma, no estilo das outras.
- Em `env.validation.spec.ts`: os quatro padrões sem as variáveis, `0` aceito nos dois timeouts de query, e a rejeição de `-1`, de `abc`, de `DATABASE_POOL_MAX=0` e de `DATABASE_CONNECT_TIMEOUT_MS=0`.
- No `.env.example`: as quatro, comentadas, com o padrão e uma linha sobre o que cada uma faz.

**Pronto quando:**

- `npm test -- env.validation` passa com os casos acima.
- `npm run typecheck` passa.

**Como ficou:**

### Passo 2: `postgresOptions` em todos os pontos de conexão

**Por quê:** hoje são 6 lugares que montam a conexão só com a `url`, mais o template do plop. Com uma função, um ajuste novo chega a todos, e um módulo gerado não nasce sem os limites.

**Faça:**

- `src/shared/infra/database/postgres-options.ts` exporta `postgresOptions(env, { migrations } = {})`. Ela recebe as cinco variáveis do banco (`DATABASE_URL` e as quatro novas) e devolve `type`, `url`, `poolSize`, `connectTimeoutMS` e `extra`. Com `migrations: true`, o `extra` não leva os dois timeouts de query. Um timeout em `0` também fica fora do `extra`, para não depender do `pg` ignorar o zero.
- `database.module.ts`: o `useFactory` espalha `postgresOptions(...)` com os valores do `ConfigService` e mantém `autoLoadEntities`, `synchronize` e `migrationsRun`.
- Os 5 data sources (`outbox`, `identity`, `orders`, `inventory`, `catalog`) e o `plop-templates/module/data-source.hbs`: `...postgresOptions(env, { migrations: true })` no lugar de `type` e `url`. Os módulos importam por `#shared/infra/database/postgres-options`, sem extensão, como já fazem com o `env.validation`.
- `postgres-options.spec.ts` (unitário): o mapeamento das variáveis para as opções, o modo migrations sem os dois timeouts de query e o `0` fora do `extra`.
- O tipo do retorno: confira no TypeORM 1.1.3 o caminho de exportação do `PostgresConnectionOptions`. Se não houver um import limpo no ESM, use `satisfies` contra o `DataSourceOptions`.

**Pronto quando:**

- `grep -rn "url: env.DATABASE_URL\|url: cfg" src plop-templates` não acha nada.
- `npm test -- postgres-options` e `npm run ci` passam, incluindo o `npm run arch`.
- `npm run db:setup` roda contra o Postgres do compose.
- Um módulo gerado com `npm run plop module` num worktree descartável tem o data source com a `postgresOptions`, e o `npm run typecheck` dele passa.

**Como ficou:**

### Passo 3: testes de integração dos três limites

**Por quê:** a issue pede o teste do `statement_timeout`. Os outros dois limites falham de jeitos diferentes, e um nome errado no `extra` passaria calado, porque o `pg` ignora uma chave que não conhece.

**Faça:**

- `src/shared/infra/database/postgres-options.int-spec.ts`. Cada caso abre um DataSource com a própria `postgresOptions`, com limites curtos (100 a 200 ms), apontando para o banco `postgres` do servidor do `globalSetup` (`inject('postgresUrl')` com o `databaseUrl` de `test/helpers/database.ts`). Não precisa de template nem de migration. Feche cada DataSource no fim do caso.
  1. **Statement:** `SELECT pg_sleep(1)` rejeita com `code === '57014'`, e um `SELECT 1` seguinte, no mesmo DataSource, responde.
  2. **Transação ociosa:** um `QueryRunner` abre a transação, espera além do limite, e a próxima query nele rejeita porque o servidor encerrou a sessão. Um `SELECT 1` no DataSource responde depois. Libere o `QueryRunner` mesmo com a falha.
  3. **Pool cheio:** com `poolSize: 1`, um `QueryRunner` conectado segura a única conexão. Um `SELECT 1` no DataSource rejeita com `timeout exceeded when trying to connect`, em menos que o dobro do limite.
- Leia `docs/reference/testes.md` antes: as convenções do projeto `int` e dos helpers.

**Pronto quando:**

- `npm run test:int -- postgres-options` passa em menos de 2 s.
- Trocar, de propósito, a chave `statement_timeout` por um nome errado na `postgresOptions` faz o caso 1 falhar. Desfaça depois.
- `npm run test:int` inteiro passa.

**Como ficou:**

### Passo 4: documentação

**Por quê:** é uma mudança de comportamento (limites que antes não existiam) e de configuração (variáveis novas), e a definição de pronto pede a página do quadrante afetado.

**Faça:**

- `docs/reference/variaveis-de-ambiente.md`: uma seção **Postgres** com as quatro variáveis (padrão, valores, o que faz). Uma nota: o SSL vai na `DATABASE_URL` (link para o deploy), e as migrations e os seeds rodam sem os dois timeouts de query.
- `docs/explanation/persistencia.md`: uma seção **Pool e timeouts**. Por que cada limite existe, por que a espera na fila do pool precisa de prazo, por que as migrations ficam sem os timeouts de query, por que o SSL fica só na URL, e por que `query_timeout` e `lock_timeout` ficaram de fora. Atualize a frase de abertura e a linha da página no `docs/README.md`.
- `docs/how-to/fazer-o-deploy.md`, seção **Postgres externo**:
  - dimensionar o pool: `instâncias × DATABASE_POOL_MAX` abaixo do `max_connections`, com folga para as migrations e o acesso administrativo;
  - atrás do PgBouncer em modo transaction, os dois timeouts de query em `0` e os limites no role (`ALTER ROLE <usuário> SET statement_timeout = ...`), porque o PgBouncer recusa esses parâmetros na conexão.
- `docs/explanation/servicos-externos.md`: a frase "esgotam o pool de conexões" ganha um link para a seção nova da persistência.
- `docs/explanation/comunicacao-entre-modulos.md`: o exemplo de data source passa a usar a `postgresOptions`.
- `docs/reference/evolucoes-com-gatilho.md`, seção **Infraestrutura e dados**, duas linhas:
  - `lock_timeout` nas migrations, com o gatilho "uma migration esperar lock e travar o tráfego da app, ou uma tabela crescer a ponto de um `ALTER TABLE` demorar";
  - timeouts do banco respondendo 503 com `code` próprio, com o gatilho "um cliente precisar distinguir sobrecarga do banco de erro interno".

**Pronto quando:**

- `npm run docs:check` passa.
- Cada variável nova aparece em `variaveis-de-ambiente.md` e no `.env.example`.

**Como ficou:**

### Passo 5: entrega

**Por quê:** o fluxo de entrega do `AGENTS.md` e o fechamento do plano.

**Faça:**

- `/simplify` e depois `/code-review` sobre as mudanças. Corrija o que for real.
- `npm run ci`, `npm run test:int` e `npm run test:e2e` (encerre qualquer `start:dev` antes).
- Comente na issue #18 o registro deste plano (decisões e **Como ficou** de cada passo), apague este arquivo e tire a menção a ele do `docs/README.md`. Se o `otimizacao-do-ci.md` também já tiver saído de `docs/plan/`, tire a rota "Continuar um plano em andamento" do `AGENTS.md`.
- Com o ok do dono do repositório: push e PR com o título acima, "Closes #18" na descrição, e a nota de que o comportamento muda sem configuração (queries acima de 30 s passam a falhar). Não é quebra de contrato, porque nenhuma variável é obrigatória.

**Pronto quando:**

- Todos os itens de [Critérios de aceite](#critérios-de-aceite) estão marcados.

**Como ficou:**
