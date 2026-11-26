---
status: accepted
---

# Hook síncrono do tracing

No ESM, a auto-instrumentação do OpenTelemetry só enxerga os módulos importados direto (como o `ioredis` e o `express`) com um hook de carregamento registrado antes da app ([ADR 0001](0001-vitest-e-esm.md)). O hook era registrado pelo `module.register`, que roda o hook numa thread separada e está depreciado: o Node 26 imprime o aviso `DEP0205` na subida ([issue #15](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/15)).

O `src/tracing.ts` registra o hook pelo `register` de `import-in-the-middle/register-hooks.mjs`, que usa o `module.registerHooks` síncrono e roda o hook na thread da app. Isso substitui o ponto do `module.register` nas Consequences da [ADR 0001](0001-vitest-e-esm.md). O resto dela continua valendo, inclusive a ordem do `main.ts`: o `tracing.ts` primeiro, e a app por `import()` dinâmico.

- **Dependência direta:** o `import-in-the-middle` entra no `package.json`, na mesma cópia que o `@opentelemetry/instrumentation` usa. Com duas cópias, o hook não vê os `Hook()` das instrumentações, e os spans somem sem erro.
- **Versões do Node:** o `engines.node` aceita só as versões em que o `module.registerHooks` aceita o hook (`^22.22.3 || ^24.11.1 || >=25.1.0`). Fora delas, o `register` lança erro.

O porquê do tracing carregar antes da app está em [Observabilidade](../explanation/observabilidade.md).

## Considered Options

- **Manter o `module.register`:** funciona, mas com o aviso `DEP0205` em toda subida no Node 26, e uma API depreciada pode sair numa versão seguinte do Node.
- **O hook do OpenTelemetry na linha de comando** (`--experimental-loader=@opentelemetry/instrumentation/hook.mjs`): é a forma que a documentação do OpenTelemetry suporta para ESM, mas exige a flag em todo jeito de subir a app (`nest start`, `node dist/main.js`, a imagem), e esquecê-la em um deles tira os spans sem erro. O `@opentelemetry/instrumentation` não tem hook síncrono próprio.
- **Fallback para o `module.register` fora da faixa do `engines`:** dois caminhos de carregamento para manter, um deles depreciado.

## Consequences

- O hook vem do `import-in-the-middle` direto, fora do que a documentação do OpenTelemetry suporta, e pode deixar de funcionar numa versão nova dele. A volta ao hook do OpenTelemetry, quando ele tiver um síncrono, tem gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md).
- O Node 23, o 24.0.0 a 24.11.0 e o 25.0.0 saem da faixa suportada. Neles, a app não sobe com o tracing ligado, a não ser com `OTEL_SDK_DISABLED=true`.
- Os testes não carregam o `tracing.ts`. Uma troca de versão do `import-in-the-middle` se confere à mão, com `OTEL_TRACES_EXPORTER=console`, e a cópia única, com `npm ls import-in-the-middle`.
