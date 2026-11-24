---
type: explanation
---

# Observabilidade

Por que o tracing carrega antes da app, como uma requisição continua no mesmo trace depois de passar pela outbox e pelas filas, e o que fica sem span. As variáveis do OpenTelemetry e do log estão em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md#tracing-opentelemetry).

## Contexto

Uma requisição não termina na resposta HTTP. O caso de uso grava um evento na outbox, o relay o publica numa fila, e o handler de outro módulo o processa, talvez em outra instância e segundos depois. Quando algo falha no handler, a pergunta é qual requisição o originou. Um log por etapa, sem nada que as ligue, não responde.

## Por quê

### Um trace do OpenTelemetry no lugar de um correlation id

O OpenTelemetry com auto-instrumentação cria os spans de HTTP, Express, Postgres e `ioredis` sem código na app, põe o id do trace nos logs do pino e propaga o contexto no padrão W3C (`traceparent`). Por que não um correlation id próprio está em [Alternativas e trade-offs](#alternativas-e-trade-offs).

O `x-request-id` continua existindo, mas para outra coisa: identifica a requisição no log de acesso e é devolvido ao cliente, que pode citá-lo num chamado.

### O tracing carrega antes da app

A auto-instrumentação funciona trocando o módulo carregado por uma versão instrumentada. Ela só enxerga o que é carregado **depois** dela. Por isso o `main.ts` só importa o `tracing.ts` e carrega o resto por `import()` dinâmico (`bootstrap.ts`). Um `import` estático do app no `main.ts` seria resolvido antes do código do `tracing.ts` rodar, porque o ESM resolve todos os imports estáticos de um arquivo antes de executá-lo. Uma regra de lint (`no-restricted-imports` em `src/main.ts`) barra esse import.

No ESM, a interceptação do `require` não basta. O `tracing.ts` registra o hook `@opentelemetry/instrumentation/hook.mjs` com `module.register` antes de iniciar o SDK. Sem ele, o que o código importa direto (como o `ioredis`) e o `express` ficam sem spans, e nada falha nem avisa.

O mesmo motivo mantém o `tracing.ts` com poucos imports: tudo o que ele importa carrega antes do hook e fica sem instrumentação. Ele também lê o `.env` por conta própria, porque roda antes do `ConfigModule`, e sem isso as variáveis `OTEL_*` escritas no `.env` seriam ignoradas.

### O trace atravessa a outbox e as filas

O contexto do OpenTelemetry vive no `AsyncLocalStorage` e não sobrevive a uma gravação no banco nem a uma fila. Por isso a outbox grava, junto com cada evento, o `traceparent` do span ativo, nos metadados e fora do payload de negócio, e o relay e o worker de cada fila abrem o span do processamento como filho dele (`runInEventTrace`). Assim o handler do notifications aparece no mesmo trace do `POST /v1/orders/:id/pay` que pagou o pedido, mesmo rodando em outra instância.

### Logs ligados ao trace

A instrumentação do pino grava o `trace_id` e o `span_id` (nomes padrão, que a opção `logKeys` troca) em todo log emitido dentro de um span. Com isso, os logs de todos os módulos de uma requisição, inclusive os dos handlers, se juntam pelo `trace_id`.

O log sai em JSON pelo `nestjs-pino`, para o coletor indexar os campos.

### A application loga por um port

Um caso de uso que precisa logar recebe o port `Logger` (`src/shared/application/ports/logger.ts`), e o `PinoAppLogger` o implementa na infra. A application não importa o Nest nem o pino, pela mesma regra de qualquer outra dependência ([Arquitetura](arquitetura.md)). O port recebe os campos primeiro e a mensagem depois, a ordem do pino, para o log sair estruturado.

### O que fica de fora

- **As sondas de health** (`/health/*`) não geram span nem log de acesso. O orquestrador as chama a cada poucos segundos, e elas encheriam os dois sem informação.
- **O `fs`** fica sem instrumentação: cada leitura de arquivo viraria um span.
- **A camada do Nest** (controllers, guards, handlers) fica sem spans próprios: a instrumentação do Nest não aceita o Nest 12 (gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md)). Os spans de HTTP, Express, Postgres e `ioredis` bastam para seguir uma requisição.

## Alternativas e trade-offs

- **O hook na linha de comando** (`node --experimental-loader=@opentelemetry/instrumentation/hook.mjs --import ./tracing.js`): é a forma que a documentação do OpenTelemetry mostra para ESM. Exigiria a flag em todo jeito de subir a app (`nest start`, `node dist/main.js`, a imagem de produção), e esquecê-la em um deles tira os spans sem erro. Com o `module.register` no `tracing.ts`, o hook vai junto com o código.
- **O custo do `module.register`:** no Node 26 ele está depreciado e imprime o aviso `DEP0205` na subida. A troca pelo `register-hooks.mjs` do `import-in-the-middle`, que usa o `module.registerHooks`, exige um Node acima do `engines` do projeto. O gatilho está em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md).
- **Correlation id próprio:** dispensa o SDK e o coletor, mas exige passar o id à mão em cada chamada e em cada evento, e não mede a duração das etapas.
- **Span manual no caso de uso,** para cobrir a falta dos spans do Nest: seria código do OpenTelemetry na application, o que a regra de dependência não permite.

## Decisões relacionadas

- [ADR 0001: Vitest e projeto em ESM](../adr/0001-vitest-e-esm.md): a consequência do ESM para o tracing, com o hook e o `import()` dinâmico.
- [Consistência e eventos](consistencia-e-eventos.md): a outbox e a fila por consumidor, por onde o `traceparent` viaja.
