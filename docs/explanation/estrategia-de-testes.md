---
type: explanation
---

# Estratégia de testes

## Contexto

Cada camada tem o seu tipo de teste ([Testes](../reference/testes.md#por-camada)). O domínio e os casos de uso rodam em unitários, sem banco. Os repositórios, as queries, o cache e as filas rodam na integração, contra um Postgres e um Redis de verdade. Os fluxos críticos rodam no e2e, com a app inteira.

Duas escolhas pedem explicação: o que a cobertura mede e com que meta, e como os testes de integração ficam isolados uns dos outros sem rodar em série.

## Por quê

### A cobertura mede os unitários, com piso só no domínio e na application

A integração e o e2e rodam em jobs próprios no CI. Juntar a cobertura deles com a dos unitários pediria passar os relatórios entre os jobs como artefato. Por isso o relatório mede só os unitários, e a infra aparece baixa nele: quem a cobre é a integração e o e2e.

O relatório inclui todo o `src/**/*.ts`, e não só os arquivos que algum teste carregou. Um arquivo sem teste aparece com 0%, em vez de sumir do total. O `main.ts`, o `bootstrap.ts`, o `tracing.ts` e os `*.module.ts` ficam no relatório porque rodam em produção, e o 0% deles é real. Saem só os arquivos que não são código da aplicação em execução: migrations, data sources e seeds, que rodam pela CLI ou por script, os repositórios em memória, os exemplos dos contratos e os utilitários dos testes.

A meta vale só para `domain/` e `application/`, onde a cobertura reflete regra de negócio. Na infra, o número dos unitários diria pouco, pelo motivo acima. O piso de 90% barra uma regressão grande sem obrigar a subir a cobertura a cada PR, e por isso não há `thresholds.autoUpdate`. Uma meta global misturaria a infra, baixa por construção, com o código que importa.

Com um teste falhando, o Vitest não gera relatório: a cobertura de uma execução quebrada não é o número que se quer ler. O relatório `text` por arquivo fica de fora porque encheria o log com uma linha por arquivo do `src/`.

### Um banco por arquivo, clonado de um template

Os arquivos de integração rodam em paralelo, contra um Postgres e um Redis por execução. Cada arquivo precisa de um banco que nenhum outro toca, e criar esse banco tem de ser barato.

O `CREATE DATABASE ... TEMPLATE` copia um banco já migrado em vez de rodar as migrations de novo. Há um template por conjunto de migrations de cada módulo, e não um só com tudo: assim, a migration de um módulo continua sem poder depender do schema de outro, como na app, onde cada módulo roda as suas.

O Postgres dos testes roda sem durabilidade (`fsync`, `synchronous_commit` e `full_page_writes` desligados, dados em tmpfs) porque é descartado no fim da execução. Perder os dados numa queda não custa nada, e a escrita fica mais rápida.

No Redis, cada worker do Vitest usa o próprio banco lógico. O Redis sobe com `--databases 128` porque os 16 bancos do padrão colidiriam numa máquina com mais de 16 workers. Um teste limpa só o banco dele, com `FLUSHDB`, e nunca `FLUSHALL`, que apagaria os dos outros workers.

## Alternativas e trade-offs

- **Schema por arquivo:** as migrations criam schemas com nome fixo (`orders`, `identity`), então dois arquivos no mesmo banco colidiriam.
- **Rollback por teste:** cada teste roda numa transação desfeita no fim. Quebra os testes de transação, de concorrência e da outbox, que abrem conexões próprias e não enxergam a transação do teste.
- **`TRUNCATE` entre arquivos:** um banco só, limpo entre um arquivo e outro. Obrigaria os arquivos a rodar em série.
- **Cobertura da integração e do e2e no CI:** mediria a infra de verdade, ao custo de um job que junta os relatórios por artefato. O gatilho está em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#ci). Localmente, a integração já entra com `npx vitest run --project unit --project int --coverage`.
- **Meta global ou `autoUpdate`:** uma meta global puxaria para baixo por causa da infra, ou obrigaria a escrever unitário para o que a integração já cobre. O `autoUpdate` sobe o piso a cada melhora, e uma queda pequena e legítima passaria a falhar o CI.

## Decisões relacionadas

- [ADR 0001](../adr/0001-vitest-e-esm.md): o Vitest como runner, com o projeto em ESM.
