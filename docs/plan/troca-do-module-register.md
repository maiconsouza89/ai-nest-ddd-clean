# Plano da troca do `module.register` (DEP0205) (#15)

A issue #15 pede a troca do `register` do `node:module` no `src/tracing.ts` pelo `register` de `import-in-the-middle/register-hooks.mjs`, que usa o `module.registerHooks` e roda o hook na thread da app. O `module.register` está depreciado e imprime o aviso `DEP0205` na subida do Node 26. A linha de [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#código-e-dependências) sai, e o [Observabilidade](../explanation/observabilidade.md) deixa de dizer que a troca exige um Node acima do `engines`.

**Mudanças em relação ao texto da issue:**

- **O gatilho foi atingido só em parte.** O `engines` atual, `>=22.22.3`, também aceita o Node 23, o 24.0.0 a 24.11.0 e o 25.0.0. Nessas versões, o `module.registerHooks` existe, mas recusa o `source` nulo que o hook devolve para CommonJS (nodejs/node#59929), e o `register` do `register-hooks.mjs` lança erro. O `engines` passa a `^22.22.3 || ^24.11.1 || >=25.1.0`, as versões que o `supportsSyncHooks()` do pacote aceita.
- **O CI não roda o `tracing.ts`.** Os unitários e os de integração não carregam o `main.ts`, e o e2e monta a app pelo `Test.createTestingModule`, sem o tracing. O "`npm run ci` passa no Node 22.22.3" da issue não prova a troca. Os spans e o aviso se conferem à mão, com a app compilada, no Node 22.22.3, no `.nvmrc` e no 26 (passo 3).
- **A documentação do OpenTelemetry suporta só o `@opentelemetry/instrumentation/hook.mjs`** e avisa que usar o `import-in-the-middle` direto pode deixar de funcionar (consulta no Context7 em 2026-11-25, `doc/esm-support.md`). O pacote não tem hook síncrono próprio na 0.301.2. A troca usa o `import-in-the-middle` direto mesmo assim, com ele no `package.json`, e o risco ganha uma linha nova em Evoluções com gatilho.

Tudo entra em **um PR**, na branch `build/troca-do-module-register`. O plano nasce e é apagado no mesmo PR, e o registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Versão do `import-in-the-middle` | A latest, com `^`: 3.7.0 em 2026-11-25 (o lockfile tem a 3.6.0). O `@opentelemetry/instrumentation` 0.301.2 pede `^3.0.0`, e o npm deixa uma cópia só. Na execução, confira de novo com `npm view import-in-the-middle version` |
| Uma instância só | O `Hook()` do OpenTelemetry (`dist/platform/node/instrumentation.mjs`) importa `import-in-the-middle`, e o hook síncrono precisa ser a mesma cópia para ver os registros. `npm ls import-in-the-middle` mostra uma versão, com o `@opentelemetry/instrumentation` como `deduped` |
| `engines` | `^22.22.3 \|\| ^24.11.1 \|\| >=25.1.0`. O badge do `README.md` lê o campo e passa a mostrar a faixa |
| Fallback para o `module.register` | Nenhum. Fora das versões do `engines`, o `register` lança erro com a versão exigida, e a app não sobe com o tracing ligado. É melhor que subir sem spans e sem aviso. Quem precisar subir num Node fora da faixa usa `OTEL_SDK_DISABLED=true` |
| Opções do `register` | Nenhuma (`include`, `exclude`, `shouldInclude`), como hoje com o `hook.mjs`: o hook intercepta todo módulo, e o `Hook()` de cada instrumentação escolhe o que corrigir |
| Matriz do CI | Sem mudança. O `22.22.3` continua o mínimo da linha 22, e o `.nvmrc` (24) resolve para uma 24 acima da 24.11.1. Um 24.11.1 na matriz não testaria nada a mais, porque os unitários não carregam o `tracing.ts` |
| ADRs | Sem mudança. O ADR 0001 cita o `module.register` e o ADR 0004 cita o `eslint-disable`, mas ADR é registro imutável ([docs/README.md](../README.md#decisões-adr)). A explicação atual fica no `observabilidade.md` |
| Tipo do commit e do PR | `build`: a mudança é de dependência, de `engines` e do jeito de carregar o tracing, sem comportamento novo na API. Sem `!`: o Node 24 anterior ao 24.11.1 saiu do suporte da linha 24 com patches, e a descrição do PR cita a faixa nova |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Um teste automático que suba a app com o tracing e confira os spans | Nenhum por enquanto. A #17 (métricas) mexe no mesmo `tracing.ts` e pode propor um, se o dono quiser |
| Voltar ao hook do OpenTelemetry quando ele tiver um síncrono | A linha nova em Evoluções com gatilho (passo 4) |
| Métricas com OpenTelemetry | Issue #17, na mesma trilha, depois do merge desta |

## Referências

- Issue #15: `gh issue view 15`.
- `import-in-the-middle` 3.6.0 instalado: `node_modules/import-in-the-middle/register-hooks.mjs`, `register-hooks.d.mts`, `supports-sync-hooks.mjs` e a seção "Synchronous loader hooks" do README. O pacote não está no Context7: a fonte é o código e o README do pacote.
- OpenTelemetry JS, consultado no Context7 em 2026-11-25: `doc/esm-support.md` ("The only currently supported loader hook is `@opentelemetry/instrumentation/hook.mjs`").
- Código: `src/tracing.ts`, `src/main.ts`, `package.json` (`engines`).
- Páginas a mudar: `docs/reference/evolucoes-com-gatilho.md` (linha 15), `docs/explanation/observabilidade.md` (linhas 25, 51 e 52), `README.md` (linha 49), `docs/reference/comandos.md` (linha 11), `docs/tutorials/01-do-clone-ao-primeiro-pedido.md` (linha 17).
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): `evolucoes-com-gatilho.md` com a #16 (uma linha cada), `package.json` e `package-lock.json` com várias, e o `tracing.ts` e o `observabilidade.md` com a #17, que vem depois desta na trilha C. A ordem de merge põe a #15 depois da #13 e da #16: faça rebase sobre a `main` antes do PR e refaça o lockfile com `npm install`.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal: data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR e comentário na issue só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | `import-in-the-middle` no `package.json` e `engines` | ✅ |
| 3 | Troca no `tracing.ts` e conferência dos spans | ✅ |
| 4 | `evolucoes-com-gatilho.md` e `observabilidade.md` | ✅ |
| 5 | Verificação, revisão, registro e PR | 🟡 |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha C com a branch `build/troca-do-module-register` e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Traga este plano para a branch.
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #15 como 🟡.
4. Commit: `docs(plan): plano da troca do module.register (#15)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: dependência e `engines`

1. Antes de mudar, guarde a linha de base, para comparar no passo 3: na `main` compilada (`npm run build`), suba a app com `OTEL_TRACES_EXPORTER=console node dist/main.js`, faça um `POST /v1/auth/login` (o rate limit grava no Redis) e anote os spans de `@opentelemetry/instrumentation-ioredis`, `-express` e `-http` dessa requisição. Repita no Node 26 (`npx -y node@26 dist/main.js`) e confirme que o aviso `DEP0205` aparece: sem isso, a conferência do passo 3 não prova nada.
2. `npm install import-in-the-middle@latest`. Confira:
   - `npm ls import-in-the-middle`: uma versão, com o `@opentelemetry/instrumentation` como `deduped`.
   - A dependência fica em `dependencies`, ao lado das `@opentelemetry/*`, porque o `tracing.ts` roda em produção.
3. No `package.json`, `engines.node` passa a `^22.22.3 || ^24.11.1 || >=25.1.0`.
4. Troque "Node 22.22.3 ou superior" pela faixa nova, em palavras, no `README.md` (requisitos), no `docs/reference/comandos.md` (requisitos) e no tutorial `01-do-clone-ao-primeiro-pedido.md`. Formato sugerido: "Node 22.22.3 ou superior na linha 22, ou 24.11.1 ou superior (`engines` do `package.json`). O `.nvmrc` recomenda o 24."
5. Commit: `build(deps): adiciona o import-in-the-middle e restringe o engines às versões com registerHooks (#15)`.

### Passo 3: troca no `tracing.ts`

1. No `src/tracing.ts`:
   - Troque `import { register } from 'node:module'` por `import { register } from 'import-in-the-middle/register-hooks.mjs'`. O pacote não tem `exports`, e o `nodenext` acha os tipos no `register-hooks.d.mts`.
   - Troque a chamada por `register()`, sem argumentos.
   - Tire o `eslint-disable-next-line @typescript-eslint/no-deprecated`.
   - Reescreva o comentário acima da chamada: o hook do `import-in-the-middle` permite instrumentar o que o código importa direto (como o `ioredis`), roda na thread da app pelo `module.registerHooks`, precisa da mesma cópia do pacote que o `@opentelemetry/instrumentation` usa e lança erro fora das versões do `engines`.
2. `npm run typecheck` e `npm run lint`.
3. Confira à mão, com `npm run build` e o mesmo `POST /v1/auth/login` do passo 2:
   - **Node do `.nvmrc`:** `OTEL_TRACES_EXPORTER=console node dist/main.js`. Os spans de `ioredis`, `express` e `http` aparecem, na mesma quantidade da linha de base. Um span duplicado indica que o hook síncrono, que também passa pelo `require`, e o `require-in-the-middle` corrigiram o mesmo módulo.
   - **Node 22.22.3:** `OTEL_TRACES_EXPORTER=console npx -y node@22.22.3 dist/main.js`. Os mesmos spans.
   - **Node 26:** `OTEL_TRACES_EXPORTER=console npx -y node@26 dist/main.js`. Os mesmos spans, e nenhum `DEP0205` na subida.
   - **Fora da faixa (opcional):** `npx -y node@24.11.0 dist/main.js` para na subida com a mensagem do `import-in-the-middle`, e sobe com `OTEL_SDK_DISABLED=true`.
   - **`npm run start:dev`:** sobe e recompila sem o aviso de hook já registrado.
4. Se a troca falhar no Node 22.22.3, pare: a issue manda corrigir o gatilho para a versão certa. Nesse caso, desfaça os passos 2 e 3, ajuste a condição da linha em Evoluções com gatilho e leve a mudança de escopo ao dono antes de seguir.
5. Commit: `build(tracing): troca o module.register pelo hook síncrono do import-in-the-middle (#15)`.

### Passo 4: documentação

1. Em `docs/reference/evolucoes-com-gatilho.md`, na tabela "Código e dependências":
   - Tire a linha do `engines` e do `module.register`.
   - No lugar dela, acrescente uma linha para o risco de usar o `import-in-the-middle` direto. Texto sugerido, para ajustar ao tom da página:

     | Condição | O que fazer | Contexto |
     | --- | --- | --- |
     | O `@opentelemetry/instrumentation` publicar um hook síncrono próprio (com o `module.registerHooks`), ou um update do `import-in-the-middle` tirar ou mudar o `register-hooks.mjs` | Trocar o `register` do `tracing.ts` pelo hook do OpenTelemetry e tirar o `import-in-the-middle` do `package.json`. A documentação do OpenTelemetry suporta só o `@opentelemetry/instrumentation/hook.mjs`, e avisa que o `import-in-the-middle` direto pode deixar de funcionar. Confira que os spans do `ioredis` e do `express` continuam aparecendo | [Observabilidade](../explanation/observabilidade.md) |

2. Em `docs/explanation/observabilidade.md`:
   - Linha 25: o `tracing.ts` registra o hook do `import-in-the-middle` (`register-hooks.mjs`) antes de iniciar o SDK. Mantenha o motivo (sem ele, o `ioredis` e o `express` ficam sem spans, sem erro nem aviso).
   - Linha 51: "Com o `module.register` no `tracing.ts`" passa a "Com o registro no `tracing.ts`".
   - Linha 52: troque o bullet "O custo do `module.register`" por um sobre a escolha atual. Por que o hook síncrono: o `module.register` está depreciado (`DEP0205` no Node 26) e roda o hook numa thread separada. O custo: o hook vem do `import-in-the-middle` direto, fora do que a documentação do OpenTelemetry suporta, por isso o pacote fica no `package.json`, na mesma cópia do OpenTelemetry, e a volta ao hook do OpenTelemetry tem gatilho em Evoluções com gatilho. Diga também que o hook exige as versões do `engines` e que fora delas a app não sobe com o tracing ligado.
3. Confira as âncoras citadas com `npm run docs:check`.
4. Commit: `docs(observabilidade): hook síncrono do import-in-the-middle no lugar do module.register (#15)`.

### Passo 5: verificação, revisão, registro e PR

1. `npm run ci`. A mudança não toca banco, Redis, filas nem HTTP da app: `test:int` e `test:e2e` só se o `/simplify` ou o `/code-review` mudarem algo além do `tracing.ts`.
2. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar o `tracing.ts`, repita a conferência do passo 3 no Node do `.nvmrc`.
3. Faça rebase sobre a `main`, refaça o lockfile com `npm install` se houver conflito nele e rode `npm run ci` de novo.
4. Com o ok do dono: push e PR com o título `build(tracing): troca o module.register pelo hook síncrono do import-in-the-middle (#15)`. A descrição traz as três mudanças em relação à issue (a faixa do `engines`, o CI que não roda o `tracing.ts` e o hook fora do suporte do OpenTelemetry), a tabela da conferência manual por versão do Node e a faixa nova do `engines` para quem usa o template.
5. Com o ok do dono: comentário de registro na issue, com este plano e os mesmos pontos da descrição.
6. Último commit da branch (`docs(plan): fecha o plano da troca do module.register (#15)`):
   - Apague este plano.
   - No roadmap, marque a #15 como ✅, com o número do PR na linha.
   - Na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #15, como os das issues #35 e #18.
   - Rode `npm run docs:check` de novo e faça push.
