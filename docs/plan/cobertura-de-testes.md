# Plano do relatório de cobertura de testes (#21)

A issue #21 pede que o projeto meça a cobertura de testes. Ela propõe o `@vitest/coverage-v8`, um script `test:coverage` e o relatório no resumo do job do CI, sem meta global rígida. Se houver meta, ela vale só em `domain/` e `application/`, onde a cobertura reflete regra de negócio. O pronto: `npm run test:coverage` gera o relatório, `npm run ci` passa, e `docs/reference/testes.md` e `docs/reference/comandos.md` descrevem o comando.

**Mudanças em relação ao texto da issue:** nenhuma de escopo. Três pontos que a issue não cobre:

- **O `.gitignore` não tem `coverage`.** A issue cita o `eslint.config.mjs`, que já ignora a pasta. O Prettier, o markdownlint e o remark leem o `.gitignore`, e sem a linha o `npm run ci` passaria a conferir o HTML do relatório. A linha entra no passo 2.
- **Quem roda os unitários no CI é o job `unit`, e não o `check`.** O `check` roda o `ci:static` e o `audit:signatures`. O `unit` roda em matriz (Node 22.22.3 e `.nvmrc`) e, em PR, só os testes afetados (`--changed HEAD^1`). A cobertura entra numa das entradas da matriz, no lugar do `npm test`, sem rodar a suíte duas vezes.
- **A regra `code_coverage` do ruleset, que o roadmap cita, fica de fora** (decisão abaixo). Ela pede o GitHub Code Quality, que a documentação dá como disponível no GitHub Team e no Enterprise Cloud, e o repositório é de uma conta pessoal.

Tudo entra em **um PR**, na branch `ci/relatorio-de-cobertura`. O plano nasce e é apagado no mesmo PR. O registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-25, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Provider | `@vitest/coverage-v8`, o que a issue pede e o padrão do Vitest. A versão é a do `vitest` instalado: o pacote declara o `vitest` como peer na versão exata (5.1.2 pede `vitest: 5.1.2`). No `package.json`, com `^`, como o `vitest`. O grupo `vitest` do Dependabot (`vitest`, `@vitest/*`) já atualiza os dois juntos |
| Onde fica a configuração | Em `test.coverage`, na raiz do `vitest.config.ts`. A cobertura é opção global, e não de projeto: o `--project unit` do script limita o que é medido. O `coverage.enabled` fica desligado, e o script liga com `--coverage`. O `npm test` não muda |
| Suítes medidas | Só os unitários. Medido em 2026-11-25: só com os unitários, o `domain/` fica em 96,8% das linhas e o `application/` em 99,3%. Com a integração junto, o `domain/` sobe para 98,9% (duas classes de erro) e o `application/` não muda. A integração e o e2e rodam em jobs próprios no CI, e juntar a cobertura deles pediria o blob reporter, o `--merge-reports` e duas actions novas de artefato no lockfile. A infra medida só pelos unitários fica baixa (32% das linhas), e o resumo diz por quê. Alternativa: unitários e integração, só localmente, por comando documentado |
| O que entra no relatório | `include: ['src/**/*.ts']`, para um arquivo sem teste aparecer com 0%, e não sumir. Os arquivos de teste dos três projetos já saem sozinhos (conferido: nenhum `*.spec.ts`, `*.int-spec.ts` ou `*.e2e-spec.ts` no relatório). O `exclude` tira o que não é código da aplicação em execução: `**/migrations/**`, `**/*.data-source.ts`, `**/seeds/**`, `**/in-memory/**` (repositórios de teste), `src/**/contracts/events/*.example.ts` (exemplos dos testes de contrato) e `src/shared/testing/**`. O `main.ts`, o `bootstrap.ts`, o `tracing.ts` e os `*.module.ts` ficam: são código que roda, e o 0% deles é real |
| Reporters | `text-summary` (terminal e log do CI), `html` (local, `coverage/index.html`) e `json-summary` (entrada do resumo do CI). Sem `text` por arquivo, que lista uns 260 arquivos no log, e sem `lcov` ou `cobertura`, que ninguém lê. `reportOnFailure` fica `false`, o padrão: a cobertura de uma execução com teste falhando não é o número que se quer ler |
| Meta | Piso de 90% nas quatro métricas (linhas, statements, branches e funções), só em `src/**/domain/**` e `src/**/application/**`, por `coverage.thresholds` com glob. Sem meta global. Os números medidos deixam de 3 a 10 pontos de folga (pior caso: branches do `application/`, em 93,1%). O piso barra uma regressão grande sem obrigar a subir a cobertura. Sem `thresholds.autoUpdate`, que reescreveria o `vitest.config.ts` a cada execução. Alternativas: nenhuma meta (só o relatório, como a issue pede para o começo) ou meta também global |
| `npm run ci` | Com a meta, o `ci` passa a rodar `test:coverage` no lugar de `test`, para a falha de meta aparecer antes do push. Custa uns 8 s locais (7 s sem cobertura, 15 s com, medido em 2026-11-25) |
| Onde o CI mede | No job `unit`, só na entrada `.nvmrc` da matriz, que troca o `npm test` pelo `npm run test:coverage`. A entrada do Node 22.22.3 continua com `npm test -- --changed HEAD^1`. Nenhum `uses:` novo: o `actions.lock` não muda |
| Suíte inteira no PR | A entrada com cobertura roda os unitários inteiros também em PR, sem o `--changed`. Com o `--changed`, o `coverage.changed` herda a base e o relatório fica só com os arquivos do diff: o número muda de PR para PR, e a meta valeria sobre um recorte. O custo é de uns 10 s num job que não está no caminho crítico (na run `45671463163` da `main`, o `unit (Node .nvmrc)` levou 10 s e o `e2e`, 1m47s). Alternativa: manter o `--changed` e o resumo mostrar só os arquivos que o PR muda |
| Resumo no job | Script próprio, `scripts/coverage-summary.mjs`, que lê o `coverage/coverage-summary.json` e escreve no `$GITHUB_STEP_SUMMARY` uma tabela por camada (`domain`, `application`, `contracts`, infra e o resto, total). A visão por camada é a que a issue pede, e nenhuma action pronta a dá. Alternativas: a `davelosert/vitest-coverage-report-action` (v2.13.2), que comenta no PR e compara com a base, mas roda código de terceiro com o token, pede `pull-requests: write` para comentar, entra no lockfile e no Dependabot, e a comparação pede o relatório da `main` como artefato; ou o reporter `text` num arquivo, colado no resumo num bloco de código, sem código novo mas sem a visão por camada |
| Quando o resumo aparece | Num step próprio, com `if: "!cancelled() && matrix.coverage && hashFiles('coverage/coverage-summary.json') != ''"`. Ele aparece também quando a meta falha, que é quando mais importa, e some quando um teste falha (sem relatório) e numa execução cancelada. O `!cancelled()` substituiu o `always()` por decisão do dono, depois do `/code-review` do passo 6. Confira no passo 3 que o Vitest grava o relatório antes de conferir a meta |
| Resumo dos testes | O reporter `github-actions` do Vitest já escreve, sozinho, o resumo dos testes no `$GITHUB_STEP_SUMMARY` de cada job. O de cobertura entra depois dele, no mesmo resumo |
| Regra `code_coverage` do ruleset | Não entra. A regra existe na REST API (`code_coverage`, com `minimum_coverage` e `max_coverage_drop`, só de linhas), mas pede o GitHub Code Quality ligado e o upload da cobertura em Cobertura XML pela `actions/upload-code-coverage@v1`, com `code-quality: write`. O changelog dá a regra para o GitHub Team e o Enterprise Cloud, e o repositório é de uma conta pessoal, sem o campo do Code Quality no `security_and_analysis`. O guia da regra ainda diz "public preview". Não deu para confirmar que ela funciona aqui. Vira uma linha em Evoluções com gatilho, e o `setup-github.mjs` não muda |
| `.gitignore` | A linha `coverage`. O `.dockerignore` é lista de permitidos e não muda |
| Teste do script | A lógica pura, num módulo com tipos em `.d.mts` e spec em `test/scripts/`, como o `scripts/worktree-env.mjs` |
| Tipo do commit e do PR | `ci`: muda o workflow e o ferramental de teste, sem comportamento novo na API. Sem `!`: nenhum comando existente muda de sentido |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Cobertura da integração e do e2e no CI | Linha em Evoluções com gatilho: blob reporter em cada job e um job que junta com `--merge-reports`, com `actions/upload-artifact` e `actions/download-artifact` no lockfile. Gatilho: uma regra de negócio passar a ser testada só na integração, ou o dono querer a meta na infra |
| Regra `code_coverage` do ruleset | Linha em Evoluções com gatilho. Gatilho: o repositório ter o GitHub Code Quality (organização no GitHub Team ou no Enterprise Cloud). O que fazer: reporter `cobertura`, upload pela `actions/upload-code-coverage@v1`, check do upload obrigatório (a regra não espera o upload) e a regra no `setup-github.mjs` |
| Comentário no PR com a diferença para a `main` | Linha em Evoluções com gatilho. Gatilho: o resumo do job não bastar na revisão. Pede o relatório da `main` guardado como artefato e permissão de escrita no PR |
| HTML do relatório como artefato do CI | Não entra. Seria uma action nova no lockfile para um relatório que se gera localmente em 15 s |
| Badge de cobertura no README | Não entra. Pede serviço de fora ou um gist com token |
| Subir a cobertura da infra | Não é desta issue. A infra é coberta pela integração e pelo e2e |
| ADR | Não entra. As escolhas cabem no `testes.md` e não mudam uma decisão registrada. As alternativas descartadas vão no registro da issue |

## Referências

Consultadas em 2026-11-25.

| Assunto | Fonte |
| --- | --- |
| `coverage.include` (sem ele, só os arquivos importados), `exclude`, `reporter` (padrão `text`, `html`, `clover`, `json`), `reportsDirectory`, `reportOnFailure`, `thresholds` por glob (o glob não herda o `perFile`; todos os arquivos contam na meta global) e os comentários `v8 ignore` | Context7, `/vitest-dev/vitest`. O Context7 não tem a 5.1.2 indexada e serviu a documentação atual |
| `coverage.changed`: herda o `--changed` e limita o relatório aos arquivos do diff | Context7, `/vitest-dev/vitest` (`docs/config/coverage.md` e o post do Vitest 4.1) |
| `--project` com `--coverage`: só os arquivos do projeto filtrado entram | Context7, `/vitest-dev/vitest` (`test/coverage-test/test/workspace.project-filter.test.ts`) |
| Reporter `github-actions`: resumo dos testes no `$GITHUB_STEP_SUMMARY`, sem cobertura | Context7, `/vitest-dev/vitest` (`docs/guide/reporters.md`) |
| Versões: `vitest` 5.1.2 instalado e latest; `@vitest/coverage-v8` latest 5.1.2, peer `vitest: 5.1.2` | `npm view` |
| Regra `code_coverage` na REST API: `minimum_coverage` e `max_coverage_drop` | <https://docs.github.com/en/rest/repos/rules> |
| Restrict code coverage: pede o Code Quality, não espera o upload, "public preview" | <https://docs.github.com/en/code-security/how-tos/maintain-quality-code/restrict-code-coverage> |
| Upload: `actions/upload-code-coverage@v1`, só Cobertura XML, `code-quality: write` | <https://docs.github.com/en/code-security/how-tos/maintain-quality-code/set-up-code-coverage> |
| REST da regra em GA, só no GitHub Team e no Enterprise Cloud | <https://github.blog/changelog/2026-09-18-manage-the-code-coverage-ruleset-condition-with-the-rest-api> |
| `davelosert/vitest-coverage-report-action` v2.13.2: lê o `json-summary` e o `json`, comenta no PR por padrão (`comment-on: pr`) com o `github.token` | <https://github.com/davelosert/vitest-coverage-report-action> (`action.yml`) |

Medido em 2026-11-25, numa cópia do `HEAD` com o `@vitest/coverage-v8` 5.1.2 instalado à parte, só com `include: ['src/**/*.ts']`. O `exclude` da decisão muda a infra e o total, e não o `domain/` nem o `application/`:

| Medida | Resultado |
| --- | --- |
| `vitest run --project unit` | 7 s, 50 arquivos, 316 testes |
| O mesmo com cobertura | 15 s. Total: 49,5% das linhas |
| `domain/` (43 arquivos) | Linhas 96,8%, statements 96,1%, branches 96,2%, funções 95,7% |
| `application/` (54 arquivos) | Linhas 99,3%, statements 98,1%, branches 93,1%, funções 100% |
| Infra e o resto (151 arquivos, com o `catalog`, que não tem camadas) | 32% das linhas |
| Unitários e integração com cobertura | 40 s. Total: 76,2% das linhas; `domain/` 98,9%; `application/` 99,3%; infra e o resto 66,9% |
| Repositório | Conta pessoal (`owner.type: User`), público, `allowed_actions: all`, `sha_pinning_required: true` e a política "Require lockfile" ativa |

Código e configuração:

- `vitest.config.ts` (projetos `unit`, `int` e `e2e`; `forceRerunTriggers`);
- `package.json` (scripts `test`, `ci` e `ci:static`);
- `.github/workflows/ci.yml` (job `unit`, matriz e `VITEST_ARGS`);
- `.github/dependabot.yml` (grupo `vitest`);
- `scripts/worktree-env.mjs`, `scripts/worktree-env.d.mts` e `test/scripts/worktree-env.spec.ts` (modelo do script testado);
- `.gitignore`, `.prettierignore`, `.markdownlint-cli2.jsonc` e o `docs:check` (o que lê o `.gitignore`).

Páginas a mudar:

- `docs/reference/testes.md` (seção nova "Cobertura");
- `docs/reference/comandos.md` (Testes, Verificação e CI);
- `docs/reference/versoes-e-excecoes.md` (o peer exato do `@vitest/coverage-v8`);
- `docs/reference/evolucoes-com-gatilho.md` (seção CI);
- `AGENTS.md` (Verificação: o `npm run ci` com a meta).

Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): o `ci.yml` também muda na #23, e o `package.json`, o `package-lock.json` e o `comandos.md`, na #22 e na #23. Quem entra depois faz rebase, e o lockfile se refaz com `npm install`.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Cada passo termina num **Pronto quando**. Ao fim, registre um **Como ficou** curto: o que mudou em relação ao passo e o que foi conferido.
- Antes de usar uma opção do Vitest que o repositório ainda não usa, confira no Context7 (`/vitest-dev/vitest`). Diga no **Como ficou** o que foi conferido.
- Escreva as páginas de forma atemporal, com data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR e comentário na issue só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | `@vitest/coverage-v8` e `test:coverage` | ✅ |
| 3 | Meta em `domain/` e `application/` | ✅ |
| 4 | Resumo da cobertura no job `unit` | 🟡 |
| 5 | Documentação | ✅ |
| 6 | Verificação, revisão, registro e PR | 🟡 |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha E com a branch `ci/relatorio-de-cobertura` e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Traga este plano para a branch.
3. No [roadmap](roadmap-das-issues-abertas.md):
   - marque a #21 como 🟡;
   - em "Arquivos em comum", tire a #21 da linha do `actions.lock`, se nenhum `uses:` mudar, e da linha do `setup-github.mjs`, porque a regra `code_coverage` ficou de fora.
4. `npm run docs:check`.
5. Commit: `docs(plan): plano do relatório de cobertura de testes (#21)`. Confira o formato em `.github/CONTRIBUTING.md`.

**Pronto quando:** o `docs:check` passa.

**Como ficou:** o plano já estava na `main` (PR #50), então a branch o trouxe ao nascer da `main`. No roadmap, a #21 ficou 🟡 e saiu das linhas do `actions.lock` e do `setup-github.mjs`; a do `setup-github.mjs` ficou só com a #13 e sem conflito. O `docs:check` passou.

### Passo 2: `@vitest/coverage-v8` e `test:coverage`

1. Confira as versões: `npm view @vitest/coverage-v8 version`, `npm view @vitest/coverage-v8 peerDependencies` e o `vitest` do `package-lock.json`. Se a latest do `vitest` subiu, atualize os dois juntos, num commit próprio (`build(deps-dev): …`), e rode o `npm run ci`.
2. `npm install --save-dev @vitest/coverage-v8@<versão do vitest>`. Confira que o `package.json` ficou com `^`, como o `vitest`.
3. No `vitest.config.ts`, em `test` (na raiz, fora de `projects`), o bloco `coverage`:
   - `provider: 'v8'`;
   - `include: ['src/**/*.ts']`;
   - o `exclude` da tabela de decisões, com um comentário curto por grupo (por que cada um não é código da aplicação em execução);
   - `reporter: ['text-summary', 'html', 'json-summary']`;
   - um comentário no topo do bloco: só os unitários são medidos (pelo script), o porquê em uma linha e o link para `docs/reference/testes.md#cobertura`.
4. No `package.json`, o script `"test:coverage": "vitest run --project unit --coverage"`, logo depois do `test:watch`.
5. No `.gitignore`, a linha `coverage`.
6. Rode `npm run test:coverage` e confira:
   - o resumo sai no terminal;
   - `coverage/index.html` e `coverage/coverage-summary.json` existem;
   - nenhum arquivo de teste nem do `exclude` aparece no `coverage-summary.json` (um `node -e` que filtra as chaves basta);
   - os números batem, perto, com a tabela de medidas das referências. Uma diferença grande é sinal de `include` ou `exclude` errado.
7. Com a pasta `coverage/` presente, rode `npm run format:check`, `npm run lint` e `npm run docs:check`. Nenhum deles pode ler a pasta.
8. Commit: `build(test): @vitest/coverage-v8 e script test:coverage (#21)`.

**Pronto quando:** `npm run test:coverage` gera os três relatórios, e o `npm run ci` passa com a pasta `coverage/` presente.

**Como ficou:** o `vitest` continua em 5.1.2, a latest, e o `@vitest/coverage-v8` entrou em `^5.1.2` (peer `vitest: 5.1.2`); o lockfile ganhou só o provider e as dependências dele. Conferido no Context7 (`/vitest-dev/vitest`, documentação atual, sem a 5.1.2 indexada): `provider`, `include`, `exclude`, `reporter` e `thresholds` por glob. O relatório tem 222 arquivos, nenhum de teste nem do `exclude`. Os números batem com os medidos: `domain/` (43 arquivos) 96,8% das linhas, 96,1% dos statements, 96,2% dos branches e 95,7% das funções; `application/` (54) 99,3%, 98,1%, 93,1% e 100%. Com o `exclude`, a infra e o resto ficam em 29,3% das linhas (116 arquivos), o `contracts/` (9 arquivos, só tipos) não tem nada a medir, e o total em 51,4%. Com a pasta `coverage/` presente, o `format:check`, o `lint`, o `docs:check` e o `npm run ci` passaram.

### Passo 3: meta em `domain/` e `application/`

1. No bloco `coverage`, `thresholds` com dois globs, `'src/**/domain/**'` e `'src/**/application/**'`, cada um com `lines`, `statements`, `branches` e `functions` em 90. Sem chave global.
2. Confira o glob: suba um dos valores para 100 e rode `npm run test:coverage`. Ele tem que falhar citando o glob e a métrica. Volte para 90.
3. Na mesma execução com 100, confira que o `coverage/coverage-summary.json` foi gravado antes da falha. Sem isso, o `if` do step do resumo (passo 4) não serve. Se não foi gravado, leve ao dono antes de seguir.
4. Comente no código:
   - a meta é um piso contra regressão, só onde a cobertura reflete regra de negócio (issue #21);
   - um `npm run test:coverage -- <padrão>` falha a meta, porque mede só parte da suíte: para um arquivo, use `npm test -- <padrão>`.
5. No `package.json`, `"ci": "npm run ci:static && npm run test:coverage"`.
6. `npm run ci`.
7. Commit: `build(test): piso de cobertura em domain e application (#21)`.

**Pronto quando:** a meta falha com 100 e passa com 90, e o `npm run ci` passa.

**Como ficou:** como planejado. Com `lines: 100` no glob do `domain/` e a pasta `coverage/` apagada antes, o `npm run test:coverage` saiu com código 1 e `ERROR: Coverage for lines (96.8%) does not meet "src/**/domain/**" threshold (100%)`, e o `coverage/coverage-summary.json` foi gravado na mesma execução, antes da falha. Com 90, passa. O `npm run test:coverage -- money.vo` falha as quatro métricas do `domain/`, como diz o comentário. O `npm run ci` passou, com os unitários em 16 s com cobertura (a máquina dividida com outras trilhas).

### Passo 4: resumo da cobertura no job `unit`

1. `scripts/coverage-summary.mjs`:
   - uma função pura que recebe o conteúdo do `coverage-summary.json` e a raiz do repositório e devolve o Markdown;
   - camada pelo segmento do caminho: `/domain/`, `/application/`, `/contracts/`, e o resto como "infra e o resto";
   - uma tabela com uma linha por camada e o total, e as colunas linhas, statements, branches, funções e número de arquivos, em porcentagem com uma casa;
   - uma camada sem nada a medir (total 0) mostra "—", e não `NaN`;
   - o título da tabela ou uma linha abaixo dela diz o piso de `domain/` e `application/`;
   - uma linha final: só os unitários são medidos, e a infra é coberta pela integração e pelo e2e (`docs/reference/testes.md#cobertura`, em texto, porque um link relativo não funciona no resumo do job);
   - um ponto de entrada fino, que lê `coverage/coverage-summary.json` e escreve na saída padrão. Arquivo ausente é erro, com mensagem clara;
   - um comentário de cabeçalho como o do `worktree-env.mjs`: o que faz, quem chama e onde está o teste.

   Se a separação entre a lógica e a entrada pedir dois arquivos, siga o par `worktree.mjs` e `worktree-env.mjs`.
2. `scripts/coverage-summary.d.mts`, com os tipos da função pura.
3. `test/scripts/coverage-summary.spec.ts`, com um `coverage-summary.json` montado no próprio teste:
   - um arquivo em cada camada e um do `catalog`, que não tem camadas, cai em "infra e o resto";
   - as porcentagens somam `covered` e `total` por camada, e não fazem média das porcentagens dos arquivos;
   - a camada vazia mostra "—";
   - o total bate com o `total` do JSON.
4. No `.github/workflows/ci.yml`, job `unit`:
   - na entrada `.nvmrc` da matriz, `coverage: true`;
   - o step de teste se divide em dois: `if: matrix.coverage` roda `npm run test:coverage`, sem o `VITEST_ARGS`; `if: '!matrix.coverage'` roda o `npm test -- ${{ env.VITEST_ARGS }}` de sempre;
   - um step `if: "!cancelled() && matrix.coverage && hashFiles('coverage/coverage-summary.json') != ''"` roda `node scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"`;
   - um comentário curto no job: por que só uma entrada mede, e por que ela roda a suíte inteira também em PR;
   - o nome do job não muda.
5. Rode o `actionlint` local nos workflows e `gh actions-lock --verify-local`. O `actions.lock` não pode mudar: nenhum `uses:` mudou.
6. `npm test -- coverage-summary`, depois `npm run test:coverage` e `node scripts/coverage-summary.mjs`. Confira a tabela no terminal.
7. Commit: `ci: resumo da cobertura dos unitários no job unit (#21)`.

**Pronto quando:**

- o spec passa e o script imprime a tabela local;
- o `actionlint` e o `gh actions-lock --verify-local` passam, e o `actions.lock` não muda;
- no CI do PR (passo 6), o resumo do `unit (Node .nvmrc)` mostra o resumo dos testes e a tabela de cobertura, e o `unit (Node 22.22.3)` só o dos testes. Anote no **Como ficou** a duração do `unit (Node .nvmrc)` no PR, contra os 10 s da run `45671463163` da `main`.

**Como ficou:** um arquivo só, `scripts/coverage-summary.mjs`: a função pura `coverageSummary` e a entrada sob `import.meta.main` (Node 22.18 e 24.2 em diante, dentro do `engines`), que não roda quando o spec importa o módulo. A porcentagem sai com vírgula, como nas páginas. O piso de 90% fica no `COVERAGE_FLOOR` exportado pelo script, que o `vitest.config.ts` importa para os dois globs (mudança do `/simplify`, no passo 6): a tabela não diverge da meta. O spec (5 testes) passa, e o script imprime a tabela local; sem o JSON, sai com código 1 e `coverage-summary: <caminho> não existe; rode npm run test:coverage antes.`. O `actionlint` e o `gh actions-lock --verify-local` ("All 4 workflows have complete lockfile coverage.") passaram, e o `actions.lock` não mudou. Pendente, no CI do PR: o resumo dos dois `unit` e a duração do `unit (Node .nvmrc)`.

### Passo 5: documentação

1. `docs/reference/testes.md`, seção nova "Cobertura", antes de "Convenções":
   - o comando (`npm run test:coverage`) e onde sai cada relatório (terminal, `coverage/index.html`, `coverage/coverage-summary.json`);
   - o que é medido: só os unitários, sobre `src/`, e o porquê em duas frases;
   - o que fica fora do relatório e por quê (a lista do `exclude`);
   - a meta: os pisos, os globs, e que um arquivo novo em `domain/` ou `application/` sem teste pode derrubá-la;
   - que um `test:coverage` filtrado por padrão falha a meta, e que para um arquivo vale o `npm test`;
   - como medir também a integração, localmente: `npx vitest run --project unit --project int --coverage`, que exige Docker;
   - o que o CI faz: a entrada `.nvmrc` do `unit` mede, e a tabela por camada sai no resumo do job, com link para `comandos.md#ci`.
2. `docs/reference/comandos.md`:
   - em Testes, a linha do `npm run test:coverage`, com link para `testes.md#cobertura`;
   - em Verificação, a linha do `npm run ci`, que passa a rodar o `test:coverage` (passo 3);
   - em CI, a linha do `unit` na tabela de jobs (a entrada `.nvmrc` roda `npm run test:coverage`, inteira, em PR e na `main`) e um item "Cobertura" na lista, com o step do resumo e o `if` dele.
3. `docs/reference/versoes-e-excecoes.md`, em "Combinações que quebram": o `@vitest/coverage-v8` declara o `vitest` como peer na versão exata, e os dois sobem juntos, pelo grupo `vitest` do Dependabot.
4. `docs/reference/evolucoes-com-gatilho.md`, seção CI: as linhas de [Fora do plano](#fora-do-plano) que têm destino em Evoluções com gatilho, com o contexto apontando para `testes.md#cobertura` e `comandos.md#ci`.
5. `AGENTS.md`: na seção Verificação, a linha do `npm run ci` diz que os unitários rodam com a meta de cobertura.
6. `npm run docs:check`.
7. Commit: `docs: cobertura de testes (#21)`.

**Pronto quando:** cada decisão da tabela aparece numa página de `docs/` ou num comentário do código (o plano vai ser apagado), o pronto da issue sobre o `testes.md` e o `comandos.md` está atendido, e o `docs:check` passa.

**Como ficou:** como planejado. O `testes.md` ganhou a seção "Cobertura" (relatórios, o que é medido, o `exclude` numa tabela, a meta, o `test:coverage` filtrado, a medida com a integração e o CI). O `comandos.md` ganhou a linha do `test:coverage` em Testes, o `ci` com o `test:coverage` em Verificação, a linha do `unit` por entrada da matriz e o item "Cobertura" em CI. O `versoes-e-excecoes.md` ganhou o peer exato; o `evolucoes-com-gatilho.md`, as três linhas de CI (comentário no PR, integração e e2e no CI, regra `code_coverage`); o `AGENTS.md`, o `npm run ci` com a meta. As alternativas descartadas da tabela de decisões que não viraram evolução (a action de terceiro para o resumo, o reporter `text` colado no resumo, o `--changed` na entrada com cobertura) ficam para o registro na issue. O `docs:check` passou.

### Passo 6: verificação, revisão, registro e PR

1. `npm run ci`. A mudança não toca banco, Redis, filas nem HTTP: o `test:int` e o `test:e2e` locais não são exigidos. O CI roda a suíte inteira, porque o `package.json` e o `.github/workflows/**` estão no `forceRerunTriggers`.
2. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar código, repita o item 1.
3. Faça rebase sobre a `main`. O `ci.yml` pode ter mudado pela #23, e o `package.json` pela #22 ou pela #23: refaça o lockfile com `npm install` e rode `npm run ci` de novo.
4. Com o ok do dono, faça push e abra o PR com o título `ci: relatório de cobertura de testes no resumo do CI (#21)`, seguindo o template e o `.github/CONTRIBUTING.md`. A descrição traz:
   - as decisões do plano, com os números medidos;
   - o custo no CI (a duração do `unit (Node .nvmrc)` antes e depois);
   - o que ficou de fora e por quê, inclusive a regra `code_coverage`;
   - um print ou o texto da tabela do resumo do job.
5. Confira o **Pronto quando** do passo 4 no CI do PR.
6. Com o ok do dono, deixe na issue um comentário de registro com este plano: as decisões, o **Como ficou** de cada passo e as alternativas descartadas.
7. Último commit da branch, `docs(plan): fecha o plano do relatório de cobertura (#21)`:
   - apague este plano;
   - no roadmap, marque a #21 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #21, como os das issues #19 e #15;
   - rode `npm run docs:check` de novo e faça push.

**Pronto quando:** o `npm run ci` passa, o `ci`, o `dependency-review`, o `verify-lockfile` e o CodeQL passam no PR, o `/simplify` e o `/code-review` rodaram, e o registro está na #21, com o link no PR.

**Como ficou (itens 1 a 3):** o `npm run ci` passou. O `/simplify` levou o piso para o `COVERAGE_FLOOR` exportado pelo script e importado pelo `vitest.config.ts`, e o total de arquivos da tabela passou a ser derivado do JSON; a verificação do arquivo ausente ficou, porque o passo 4 pede a mensagem clara, e o reporter `html` ficou, porque é decisão da tabela. O `/code-review` (nível medium) não achou bug; dos três nits, a porcentagem da tabela passou a ser truncada, e não arredondada (89,96% aparecia como 90,0% numa execução que falhava a meta), com um teste, e o `testes.md` deixou de citar "uns 260 arquivos". O terceiro, trocar o `always()` do step do resumo por `!cancelled()`, foi ao dono, porque o `if` é decisão da tabela; ele aprovou, e o step deixou de rodar numa execução cancelada (`ci.yml`, `comandos.md` e a tabela de decisões). O rebase sobre a `main` local não mudou nada (a `main` continua em `cb8b761`), e o `npm run ci` passou de novo. Itens 4 a 7 aguardam o ok do dono.
