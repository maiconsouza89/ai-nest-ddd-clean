---
type: explanation
---

# Observabilidade

Por que o tracing carrega antes da app, como uma requisição continua no mesmo trace depois de passar pela outbox e pelas filas, por que as métricas próprias são gauges coletados só nas instâncias com worker, e o que fica sem span. As métricas, a coleta e os alertas de exemplo estão em [Observabilidade](../reference/observabilidade.md), e as variáveis do OpenTelemetry, em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md#opentelemetry).

## Contexto

Uma requisição não termina na resposta HTTP. O caso de uso grava um evento na outbox, o relay o publica numa fila, e o handler de outro módulo o processa, talvez em outra instância e segundos depois. Quando algo falha no handler, a pergunta é qual requisição o originou. Um log por etapa, sem nada que as ligue, não responde.

## Por quê

### Um trace do OpenTelemetry no lugar de um correlation id

O OpenTelemetry com auto-instrumentação cria os spans de HTTP, Express, Postgres e `ioredis` sem código na app, põe o id do trace nos logs do pino e propaga o contexto no padrão W3C (`traceparent`). Por que não um correlation id próprio está em [Alternativas e trade-offs](#alternativas-e-trade-offs).

O `x-request-id` continua existindo, mas para outra coisa: identifica a requisição no log de acesso e é devolvido ao cliente, que pode citá-lo num chamado.

### O tracing carrega antes da app

A auto-instrumentação funciona trocando o módulo carregado por uma versão instrumentada. Ela só enxerga o que é carregado **depois** dela. Por isso o `main.ts` só importa o `tracing.ts` e carrega o resto por `import()` dinâmico (`bootstrap.ts`). Um `import` estático do app no `main.ts` seria resolvido antes do código do `tracing.ts` rodar, porque o ESM resolve todos os imports estáticos de um arquivo antes de executá-lo. Uma regra de lint (`no-restricted-imports` em `src/main.ts`) barra esse import.

No ESM, a interceptação do `require` não basta. O `tracing.ts` registra o hook do `import-in-the-middle` (`register-hooks.mjs`) antes de iniciar o SDK. Sem ele, o que o código importa direto (como o `ioredis`) e o `express` ficam sem spans, e nada falha nem avisa.

O mesmo motivo mantém o `tracing.ts` com poucos imports: tudo o que ele importa carrega antes do hook e fica sem instrumentação. Ele também lê o `.env` por conta própria, porque roda antes do `ConfigModule`, e sem isso as variáveis `OTEL_*` escritas no `.env` seriam ignoradas. O `NodeSDK` também liga os exporters de métricas e de logs pelo ambiente, e não pelo código. O de métricas é escolhido pelo `OTEL_METRICS_EXPORTER`, como o de traces. O de logs fica sem uso, em `none`, porque os logs saem pelo pino ([Variáveis de ambiente](../reference/variaveis-de-ambiente.md#opentelemetry)).

### O trace atravessa a outbox e as filas

O contexto do OpenTelemetry vive no `AsyncLocalStorage` e não sobrevive a uma gravação no banco nem a uma fila ([Entrega de eventos](entrega-de-eventos.md)). Por isso a outbox grava, junto com cada evento, o `traceparent` do span ativo, nos metadados e fora do payload de negócio, e o relay e o worker de cada fila abrem o span do processamento como filho dele (`runInEventTrace`). Assim o handler do notifications aparece no mesmo trace do `POST /v1/orders/:id/pay` que pagou o pedido, mesmo rodando em outra instância.

### Logs ligados ao trace

A instrumentação do pino grava o `trace_id` e o `span_id` (nomes padrão, que a opção `logKeys` troca) em todo log emitido dentro de um span. Com isso, os logs de todos os módulos de uma requisição, inclusive os dos handlers, se juntam pelo `trace_id`.

Fora de `development`, o log sai em JSON, para o coletor indexar os campos. Em `development`, sai legível no terminal. O formato e os campos estão em [Operação](../reference/operacao.md#logs-de-acesso).

### A application loga por um port

Um caso de uso que precisa logar recebe o port `Logger` (`src/shared/application/ports/logger.ts`), e o `PinoAppLogger` o implementa na infra. A application não importa o Nest nem o pino, pela mesma regra de qualquer outra dependência ([Arquitetura](arquitetura.md)). O port recebe os campos primeiro e a mensagem depois, a ordem do pino, para o log sair estruturado.

### Métricas

Os traces respondem o que aconteceu com uma requisição. As métricas respondem se o serviço está saudável agora: taxa de erro, latência, fila parada e outbox atrasada, a base dos alertas. Elas saem pelo mesmo `NodeSDK` dos traces, com o exporter escolhido pelo ambiente ([Variáveis de ambiente](../reference/variaveis-de-ambiente.md#opentelemetry)). O `tracing.ts` não monta nada para elas: o SDK passa o `MeterProvider` a todas as instrumentações. Com o exporter desligado, os meters são noop e nenhuma coleta roda.

A auto-instrumentação cobre HTTP, o pool do Postgres e o runtime do Node sem código. A outbox e as filas de eventos guardam o estado no Postgres e no Redis, e nenhuma instrumentação as mede, então o projeto as mede com classes próprias no `shared/infra`, ao lado do que medem. As filas usam os nomes da telemetria do próprio BullMQ, para um painel continuar valendo se o projeto passar ao `bullmq-otel` ([Alternativas e trade-offs](#alternativas-e-trade-offs)). A lista das métricas está em [Observabilidade](../reference/observabilidade.md).

**Gauge, e `max` entre instâncias.** A contagem da outbox e a das filas são globais: toda instância que coleta lê o mesmo banco e o mesmo Redis e reporta o mesmo valor, cada uma com o seu `service.instance.id`. Por isso são gauges, e o painel agrega as instâncias com `max`, nunca com `sum`. O `service.instance.id` muda a cada subida, e cada subida cria séries novas no backend.

**Só nas instâncias com worker.** A outbox é medida só nas instâncias que rodam o worker da outbox, e as filas, só nas que rodam os workers das filas. Uma instância só de HTTP não consulta o banco nem o Redis para isso. As filas dos jobs agendados ficam de fora ([O que fica de fora](#o-que-fica-de-fora)).

**O custo de cada coleta.** Cada exportação custa uma consulta à outbox, pelos índices parciais, e uma contagem por fila no Redis, cada uma com prazo. Uma coleta que falha ou demora não observa nada e só loga: a série repete o último valor, e uma fila lenta não esconde as outras.

**O callback sai na fase 1 do desligamento.** A última exportação roda na fase 4, com o banco e o Redis já fechados. Por isso cada classe tira o callback no começo do desligamento ([Operação](../reference/operacao.md#desligamento)), e o desligamento não termina com uma coleta que falha.

**O meter é pedido na subida.** A API de métricas do OpenTelemetry não tem proxy: um meter pedido antes de o SDK registrar o `MeterProvider` fica noop para sempre. As classes pedem o meter no `onApplicationBootstrap`, e nunca no topo do arquivo.

### O que fica de fora

- **As sondas de health** (`/health/*`) não geram span nem log de acesso. O orquestrador as chama a cada poucos segundos, e elas encheriam os dois sem informação.
- **O `fs`** fica sem instrumentação: cada leitura de arquivo viraria um span.
- **As filas dos jobs agendados** ficam sem métricas. Cada `ScheduledJobProcessor` cria a fila dele, e o `shared` não tem a lista. Um job que falha já loga `error`, e o próximo disparo é a nova tentativa ([Redis](redis.md#jobs-agendados)). O gatilho para medi-las está em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md).
- **Métricas de negócio** (pedidos pagos, logins recusados) ficam de fora: pediriam um port na application, que não importa o OpenTelemetry. Gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md).
- **A camada do Nest** (controllers, guards, handlers) fica sem spans próprios: a instrumentação do Nest não aceita o Nest 12 (gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md)). Os spans de HTTP, Express, Postgres e `ioredis` bastam para seguir uma requisição.

## Alternativas e trade-offs

- **O hook na linha de comando** (`node --experimental-loader=@opentelemetry/instrumentation/hook.mjs --import ./tracing.js`): é a forma que a documentação do OpenTelemetry mostra para ESM. Exigiria a flag em todo jeito de subir a app (`nest start`, `node dist/main.js`, a imagem de produção), e esquecê-la em um deles tira os spans sem erro. Com o registro no `tracing.ts`, o hook vai junto com o código.
- **O hook síncrono do `import-in-the-middle`:** o `module.register` está depreciado (`DEP0205` no Node 26) e roda o hook numa thread separada. O `register` do `import-in-the-middle/register-hooks.mjs` usa o `module.registerHooks` e roda o hook na thread da app. O custo: o hook vem do `import-in-the-middle` direto, fora do que a documentação do OpenTelemetry suporta. Por isso o pacote fica no `package.json`, na mesma cópia que o OpenTelemetry usa, para o hook ver os `Hook()` das instrumentações, e a volta ao hook do OpenTelemetry tem gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md). O hook exige as versões do `engines`: fora delas, o `register` lança erro e a app não sobe com o tracing ligado, a não ser com `OTEL_SDK_DISABLED=true` ([ADR 0014](../adr/0014-hook-sincrono-do-tracing.md)).
- **Correlation id próprio:** dispensa o SDK e o coletor, mas exige passar o id à mão em cada chamada e em cada evento, e não mede a duração das etapas.
- **O `bullmq-otel` para as filas:** o BullMQ grava o `bullmq.queue.jobs` sozinho com o `telemetry` dele, mas o `telemetry` pede `tracer` e `contextManager`, além do `meter`, e abriria spans do BullMQ ao lado do `runInEventTrace`, com outra propagação do contexto. As métricas próprias usam os mesmos nomes, menos na nova tentativa com backoff, que o BullMQ conta como `bullmq.jobs.delayed`, e a troca fica possível ([Evoluções com gatilho](../reference/evolucoes-com-gatilho.md)).
- **`UpDownCounter` somado entre instâncias:** para valores globais, cada instância reportaria o mesmo número, e a soma multiplicaria a contagem pelo número de instâncias. O gauge com `max` não depende de quantas instâncias coletam.
- **Gauge próprio do pool:** leria o `totalCount`, o `idleCount` e o `waitingCount` do pool do `DataSource` a cada coleta, sem depender dos eventos do pool. A instrumentação do `pg` já entrega o pool sem código, com as imprecisões listadas em [Observabilidade](../reference/observabilidade.md#métricas-da-auto-instrumentação), e o gauge próprio fica para quando os números dela não servirem.
- **Span manual no caso de uso,** para cobrir a falta dos spans do Nest: seria código do OpenTelemetry na application, o que a regra de dependência não permite.

## Decisões relacionadas

- [ADR 0001: Vitest e projeto em ESM](../adr/0001-vitest-e-esm.md): a consequência do ESM para o tracing, com o hook e o `import()` dinâmico.
- [ADR 0014: Hook síncrono do tracing](../adr/0014-hook-sincrono-do-tracing.md): o `register` do `import-in-the-middle` no lugar do `module.register`.
