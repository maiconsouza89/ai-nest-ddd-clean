# Plano de evolução: atualizando o projeto existente

O roteiro original, que montou o projeto do zero, está concluído e saiu do repositório. Este plano parte do código atual e aplica as decisões da revisão de 2026-11-21. Nessa revisão, cada fase do roteiro original foi conferida no Context7, no `npm view` e na documentação oficial. Algumas instruções de lá quebram hoje se seguidas do zero, mas o código já contornou quase todas. O que sobrou, e as decisões novas, estão aqui.

Decisões com contexto próprio: [ADR 0001](../adr/0001-vitest-e-esm.md) (Vitest e ESM), [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md) (ator carregado por requisição) e [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md) (imports explícitos entre módulos), [ADR 0004](../adr/0004-lint-e-formatacao.md) (lint e formatação), [ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md) (aliases de import) e [ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md) (documentação em Diátaxis e roteamento para agentes).

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**, como no roteiro original.
- Uma fase só termina com `npm run ci`, `npm run test:int` e `npm run test:e2e` passando.
- Toda fase que muda código passa por `/simplify` e depois `/code-review` antes de ser marcada (fluxo de entrega do `CLAUDE.md`).
- O guia de referência (o guia de pesquisa sobre módulos com DDD) acompanhava o código. Depois deste plano, ele foi dividido entre as páginas de `docs/` e removido (passos 12 e 15 do [plano de documentação](documentacao.md)). Os erros que já valiam para o código atual foram corrigidos na revisão. Cada fase atualiza, no próprio "Pronto quando", as seções do guia que ela muda. Assim o guia nunca descreve um código que ainda não existe.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido. A fase fica ✅ com todos os passos marcados.

### Regra de versões

A regra e a tabela de exceções, com o motivo e o gatilho de cada uma, estão em [Versões e exceções](../reference/versoes-e-excecoes.md). Os gatilhos também aparecem no passo 18.

## Mapa

| Fase | O que muda | Dependências | Status |
| --- | --- | --- | --- |
| 1. Base | Node mínimo e dependências na latest | `uuid` 14 | ✅ |
| 2. Lint e formatação | Prettier formata, ESLint com tipos pega bugs | `prettier`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier` | ✅ |
| 3. Vitest | Jest sai, Vitest entra | `vitest` | ✅ |
| 4. ESM | `"type": "module"` e CLIs em ESM | nenhuma | ✅ |
| 5. Módulos | `imports` explícito no lugar do `@Global` | nenhuma | ✅ |
| 6. Autenticação | Ator por requisição, access token curto e refresh token rotativo | nenhuma | ✅ |
| 7. Postgres 19 | Banco na versão estável mais recente | imagem `postgres:19` | ✅ |
| 8. Documentação | Guia, `CLAUDE.md` e evoluções pendentes | nenhuma | ✅ |

**Progresso geral:** 8 de 8 fases concluídas · 18 de 18 passos concluídos · Novos itens entram pelos gatilhos do passo 18

---

## Fase 1: base

> **Status:** ✅ Concluída · **Início:** 2026-11-21 · **Conclusão:** 2026-11-21
>
> - [x] Passo 1: Node mínimo declarado
> - [x] Passo 2: dependências na latest

### Passo 1: Node mínimo declarado

**Por quê:** o roteiro original pedia "Node 20 ou superior", e isso não vale mais. O `dependency-cruiser` 18 exige Node 22 ou superior, o Vitest 5 exige `^22.12 || ^24 || >=26`, e o Nest 12 é distribuído só como ESM, o que exige `require(esm)` sem flag (disponível a partir do 22.12).

**Faça:**

- `"engines": { "node": ">=22.12" }` no `package.json`.
- `.nvmrc` com `24`, a LTS recomendada. O ambiente atual usa o 26, que também serve.

**Pronto quando:** `npm install` em Node 20 avisa sobre `engines`, e em Node 24 instala sem aviso.

> O passo 4 sobe o mínimo para `>=22.13`, porque o ESLint 10 exige `^20.19 || ^22.13 || >=24`.

### Passo 2: dependências na latest

**Por quê:** em 2026-11-21, só três pacotes estavam fora da latest sem motivo registrado na tabela de exceções: `ioredis` 5.11 (latest 6.0.0), `uuid` 11.1 (latest 14.0.3) e `typescript` (este é exceção). O roteiro original dizia que "o ioredis 6 conflita com o peer do BullMQ", e isso está errado: o `bullmq` 6.7.8 aceita `ioredis >=5` como peer opcional e é testado com o 6.0.0. **Mas o ioredis 6 conflita com outro peer:** o `typeorm` 1.1.3 pede `ioredis ^5.0.4`, e a instalação falha com ERESOLVE. Ao executar o passo, o ioredis ficou no 5.11 e entrou na tabela de exceções.

**Faça:**

```bash
npm i uuid@latest
npm i -D typescript@~6.0
```

- O `uuid` 12 em diante é só ESM. Desde a fase 4 o projeto é ESM e carrega o `uuid` nativamente. Os testes (Vitest) também carregam o `uuid` sem flag.
- O `ioredis` fica no 5.11 (ver a [tabela de exceções](../reference/versoes-e-excecoes.md#exceções)). Quando o `typeorm` aceitar o 6, revise `BullMqConnection`, `RedisThrottlerStorage` e o `keys` do e2e de throttle: o 6 usa RESP3 por padrão (`protocol: 2` mantém o formato do 5).

**Pronto quando:** `npm outdated` lista só os pacotes da tabela de exceções, e `ci`, `test:int` e `test:e2e` passam.

---

## Fase 2: lint e formatação

> **Status:** ✅ Concluída · **Início:** 2026-11-21 · **Conclusão:** 2026-11-21
>
> - [x] Passo 3: Prettier
> - [x] Passo 4: ESLint com informação de tipo

O projeto não tem formatador nem linter. O estilo é mantido à mão, e nada além do `tsc` olha o código antes dos testes.

**Por que antes do Vitest e do ESM:** as fases 3 e 4 mexem em muitos arquivos (53 arquivos de teste e todos os imports relativos). Com o Prettier já aplicado, os diffs dessas fases saem formatados e mostram só a mudança real. O ESLint com tipos também pega promises sem `await` antes das refatorações de ESM e de autenticação, que mexem em código assíncrono.

Cada ferramenta tem uma responsabilidade, sem sobreposição:

| Ferramenta | Responsável por |
| --- | --- |
| `tsc --noEmit` | tipos |
| dependency-cruiser | fronteiras entre módulos e camadas (ADR 0003) |
| ESLint + `typescript-eslint` | bugs que compilam: promises, `any` inseguro, código morto |
| Prettier | formatação |

### Passo 3: Prettier

**Por quê:** sem formatador, os diffs misturam formatação com mudança de verdade, e cada pessoa (ou agente) formata de um jeito. A medição de 2026-11-21, com `singleQuote`, mostra quantos dos 288 arquivos `.ts` mudam conforme o `printWidth`: 164 com 80, 75 com 100 e 68 com 120. O 100 corta o diff pela metade em relação ao padrão, e a partir dele o ganho é pequeno.

**Faça:**

```bash
npm i -D --save-exact prettier
```

Versão consultada em 2026-11-21: `prettier` 3.10.1. A doc do Prettier recomenda fixar a versão exata, porque até um patch pode mudar a formatação. A regra de versões continua valendo: a versão fixada é a latest, e cada atualização vem num commit próprio, com a reformatação que ela causar.

- `.prettierrc.json`: `{ "singleQuote": true, "printWidth": 100 }`. O `trailingComma: "all"` já é o padrão do Prettier 3.
- `.prettierignore`: `plop-templates/` (o Prettier formataria os `.hbs` como Handlebars HTML e quebraria os templates), `**/migrations/` (geradas pelo TypeORM), `package-lock.json` e `*.md` (o Prettier reformataria as tabelas dos docs, e a formatação deles é uma decisão à parte). O `.gitignore` já é respeitado por padrão desde o Prettier 3, então `dist`, `node_modules` e `.env` não precisam entrar.
- Scripts: `"format": "prettier --write ."` e `"format:check": "prettier --check ."`.
- Rode `npm run format` num **commit só com a formatação**. Ponha o hash dele num `.git-blame-ignore-revs` na raiz e rode `git config blame.ignoreRevsFile .git-blame-ignore-revs` (o GitHub lê o arquivo sozinho).

**Pronto quando:** `npm run format:check` passa, e `npm run ci` passa logo depois do commit de formatação, sem nenhum outro ajuste.

### Passo 4: ESLint com informação de tipo

**Por quê:** o `tsc` aceita uma promise que ninguém espera. Exemplo na época: `bootstrap();` em `src/main.ts`, sem `await` nem `void` (hoje é `void bootstrap()` em `src/bootstrap.ts`). Num projeto com outbox, BullMQ e handlers de eventos, um `publish()` sem `await` perde o erro sem avisar. As regras com tipo do `typescript-eslint` pegam isso: `no-floating-promises`, `no-misused-promises`, `await-thenable` e `require-await`, entre outras.

O ESLint **não** cuida das fronteiras entre módulos. Nada de `eslint-plugin-boundaries` nem de `no-restricted-imports` para isso: as regras da ADR 0003 ficam só no dependency-cruiser, para não terem duas fontes de verdade.

**Faça:**

```bash
npm i -D eslint @eslint/js typescript-eslint eslint-config-prettier
```

Versões consultadas em 2026-11-21: `eslint` 10.15.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.73.0 e `eslint-config-prettier` 10.1.8. Usamos o `eslint-config-prettier`, que só desliga as regras de estilo. O `eslint-plugin-prettier`, que o template do `nest new` usa, roda o Prettier como regra de lint. A doc do `typescript-eslint` desaconselha isso, porque é mais lento e mostra formatação como erro.

- `"engines": { "node": ">=22.13" }`: o ESLint 10 exige `^20.19 || ^22.13 || >=24`.
- `eslint.config.mjs` (o ESLint 10 só aceita *flat config*):

```js
// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist', 'coverage', '**/migrations/**', 'plop-templates']),
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // expect(repo.save).toHaveBeenCalled() passa o método solto, e isso é intencional nos testes
    files: ['**/*.spec.ts', '**/*.int-spec.ts', 'test/**/*.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  prettier,
);
```

- O `files` cobre só o que está no `tsconfig.json`. O `plopfile.mjs` e o `.dependency-cruiser.js` ficam fora do `projectService`, que daria erro neles.
- Comece pelo `recommendedTypeChecked`, não pelo `strictTypeChecked`. O `strict` gera muito ruído na primeira passada. Endureça regra por regra depois, se valer a pena.
- **Não** ative o `consistent-type-imports`. Com `emitDecoratorMetadata`, transformar em `import type` uma classe injetada pelo construtor quebra a injeção de dependência do Nest em tempo de execução, e o `tsc` não avisa.
- **Não** instale o `eslint-plugin-jest`: o Jest sai na fase 3. O override do `unbound-method` acima serve para o Jest e para o Vitest.
- Scripts: `"lint": "eslint . --max-warnings 0"`, e `"ci": "npm run typecheck && npm run lint && npm run format:check && npm test && npm run arch"`.
- Adoção: `npx eslint . --fix` num commit separado, e o resto corrigido à mão. Se uma regra tiver casos demais para a fase, desligue-a no config com um comentário que diga o motivo e registre a reavaliação no passo 18. Não use `warn`: com `--max-warnings 0`, ele é só um erro adiado.
- Registre a divisão de responsabilidades da tabela acima na ADR 0004 e inclua o link no topo deste plano.

**Pronto quando:**

- `npm run ci` roda `lint` e `format:check`, e passa.
- Uma promise sem `await` de propósito num handler faz o `npm run lint` falhar. Isso prova que as regras com tipo estão ativas.
- `npx plop module rascunho` gera um módulo que passa no `lint` e no `format:check` sem ajustes. Apague o módulo de teste depois.
- No guia, a seção "Qualidade" cita o ESLint e o Prettier ao lado do dependency-cruiser, com a divisão de responsabilidades.

---

## Fase 3: Jest → Vitest

> **Status:** ✅ Concluída · **Início:** 2026-11-21 · **Conclusão:** 2026-11-21
>
> - [x] Passo 5: Vitest e três projetos
> - [x] Passo 6: migrar os testes e remover o Jest

Contexto e alternativas no [ADR 0001](../adr/0001-vitest-e-esm.md).

### Passo 5: Vitest e três projetos

**Por quê:** os pacotes do Nest 12 são só ESM. O Jest só os carrega com `node --experimental-vm-modules`, que é o ponto fraco dele. O Vitest é o padrão do Nest 12 em projetos ESM. O Nest injeta dependências por classe com decorator metadata. O esbuild, que o Vite 7 e anteriores usavam, não a emite, e por isso a receita oficial manda usar o SWC (docs.nestjs.com/recipes/swc). O Vitest 5 roda sobre o Vite 8, cujo transformador padrão (oxc) a emite lendo o `tsconfig.json`. Validado em 2026-11-21 sem SWC: unitários, integração e e2e passam, então **não há SWC no projeto** (ver ADR 0001).

**Faça:**

```bash
npm i -D vitest
```

Versão consultada em 2026-11-21: `vitest` 5.1.1 (Vite 8.3.8).

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O oxc, transformador padrão do Vite 8, emite a decorator metadata que o Nest usa para injetar
  // por classe. experimentalDecorators e emitDecoratorMetadata vêm do tsconfig.json.
  test: {
    setupFiles: ['./test/setup-env.ts'],
    projects: [
      { test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        test: {
          name: 'int',
          include: ['src/**/*.int-spec.ts'],
          fileParallelism: false, // containers e banco compartilhados
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          fileParallelism: false, // grava no banco do docker-compose
          testTimeout: 30_000,
        },
      },
    ],
  },
});
```

Scripts:

```json
"test": "vitest run --project unit",
"test:watch": "vitest --project unit",
"test:int": "vitest run --project int",
"test:e2e": "vitest run --project e2e"
```

- Um padrão de caminho como argumento filtra os arquivos: `npm test -- money.vo` e `npm run test:int -- pay-order`. O aviso atual do `CLAUDE.md` sobre o `--testRegex` engolir o caminho deixa de valer.
- No Vitest 5 os projetos inline herdam o `setupFiles` da raiz por padrão (`extends: true` virou o padrão), então não repita. `include`, `fileParallelism` e os timeouts por projeto continuam com esses nomes (conferido no Context7).
- O `vitest.config.ts` fica na raiz, fora do `include` do `tsconfig.json`, então o `files` do ESLint (passo 4) não o alcança. Se quiser lint nele, inclua-o no `tsconfig.json` ou use `allowDefaultProject` do `projectService`.

**Pronto quando:** `npx vitest run --project unit` roda pelo menos um spec já migrado, e um teste que injeta dependência por classe num `Test.createTestingModule` passa. Esse teste prova que a metadata está sendo emitida.

### Passo 6: migrar os testes e remover o Jest

**Por quê:** os dois runners não devem conviver: cada um tem a própria config e a própria API de mock.

**Faça:**

- Em todo `*.spec.ts`, `*.int-spec.ts` e `*.e2e-spec.ts` (31, 15 e 7 arquivos), importe de forma explícita: `import { describe, it, expect, beforeEach, vi } from 'vitest'`. Não use `globals: true`.
- Troque `jest.fn`, `jest.spyOn`, `jest.useFakeTimers` e afins por `vi.*`. São 8 arquivos com `jest.` hoje.
- No `tsconfig.json`, `"types": ["node"]` (sem `jest`). O TS 6 tem `types: []` como padrão, então a lista continua explícita.
- Remova `jest`, `ts-jest`, `@types/jest` e o `jest.config.js`.
- O `require()` não existe nos módulos do Vitest. O `test/throttle.e2e-spec.ts` o usava para importar o `AppModule` depois de ligar o `THROTTLE_ENABLED`, e virou `await import('../src/app.module.js')` (o `.js` é exigido pelo `moduleResolution: nodenext` e o Vite o resolve para o `.ts`).
- `jest.setTimeout` vira `vi.setConfig({ testTimeout })`, ou o timeout do projeto no `vitest.config.ts`. O do `outbox.e2e-spec.ts` ficou redundante e saiu.
- O `test/smoke.spec.ts` (só provava que o Jest rodava) foi trocado por `src/shared/testing/decorator-metadata.spec.ts`, que prova a decorator metadata. O template do plop (`create.use-case.spec.hbs`) também passou a importar de `'vitest'`.
- O `options.exclude` do dependency-cruiser não muda, porque os sufixos `.spec`, `.int-spec` e `.e2e-spec` continuam os mesmos. O override de testes do `eslint.config.mjs` também não muda.

**Pronto quando:**

- `ci`, `test:int` e `test:e2e` passam com a mesma contagem de testes de antes, e `grep -rn "jest" src test package.json` não encontra nada.
- No guia, a seção "Qualidade" cita o Vitest no lugar do Jest.

---

## Fase 4: CommonJS → ESM

> **Status:** ✅ Concluída · **Início:** 2026-11-21 · **Conclusão:** 2026-11-21
>
> - [x] Passo 7: `"type": "module"` e extensões nos imports
> - [x] Passo 8: migrations e seeds em ESM
> - [x] Passo 9: plop e dependency-cruiser em ESM

Contexto no [ADR 0001](../adr/0001-vitest-e-esm.md). A doc do Nest diz que migrar para ESM é opcional, porque CommonJS continua suportado via `require(esm)`. A migração foi uma escolha para alinhar o projeto ao layout ESM do `nest new` e ao Vitest.

### Passo 7: `"type": "module"` e extensões nos imports

**Por quê:** com `"module": "nodenext"`, o formato de saída de cada arquivo vem do `package.json`. Basta adicionar `"type": "module"`, e todo `.ts` passa a ser emitido como ESM (guia oficial de migração do Nest 12, seção "Switching your project to ESM").

**Faça:**

- `"type": "module"` no `package.json`. O `tsconfig.json`, o `tsconfig.build.json` e o `nest-cli.json` não mudam, segundo o guia do Nest.
- Corrija os imports relativos que o `tsc` passa a apontar como sem extensão: `./money.vo` vira `./money.vo.js`. Corrija tudo de uma vez, porque a mudança não funciona pela metade.
- Troque `__dirname` por `import.meta.dirname` nos cinco data sources (`orders`, `identity`, `catalog`, `inventory` e `outbox`) e revise os `require(` de `test/throttle.e2e-spec.ts`.
- Relações do TypeORM entre entidades que se importam continuam com `Relation<>` e `import type`. Em ESM, uma referência circular em decorator gera `ReferenceError` na carga.
- Remova o cast `as unknown as CacheManagerOptions['stores']` de `src/shared/infra/cache/cache.module.ts`. Ele existe porque, sem ESM, o `Keyv` do build CJS e o do build ESM (visto pelo `cache-manager` via `cacheable`, que o ESLint instalou) são tipos diferentes para o `tsc`. Com `"type": "module"`, o `tsc` resolve tudo pelo build ESM, e o cast deixa de ser necessário.

**Pronto quando:** `npm run typecheck` e `npm run build` passam, e `node dist/main.js` sobe e responde em `/health/live`.

### Passo 8: migrations e seeds em ESM

**Por quê:** o `typeorm-ts-node-commonjs` não carrega arquivos ESM. A doc do TypeORM 1.1 manda usar o `typeorm-ts-node-esm` em projetos ESM.

**Faça:**

- Nos scripts `mig:*:gen` e `mig:*:run`, troque `typeorm-ts-node-commonjs` por `typeorm-ts-node-esm`. Testado em 2026-11-21 com Node 26, TS 6 e ts-node 10.9.2: o CLI carrega o data source e chega à conexão.
- Nos scripts `seed:*`, troque `ts-node <arquivo>` por `node --loader ts-node/esm --no-warnings <arquivo>`. É o mesmo mecanismo que o `typeorm-ts-node-esm` usa por dentro.

**Pronto quando:** num banco vazio, todos os `mig:*:run` e `seed:*` rodam. Cada `mig:*:gen` também roda e responde que não há mudanças.

### Passo 9: plop e dependency-cruiser em ESM

**Por quê:** o gerador precisa gerar código ESM, e as regras de arquitetura precisam continuar resolvendo os imports com extensão `.js`.

**Faça:**

- Templates em `plop-templates/module/`: imports relativos com `.js`, e `import.meta.dirname` no `data-source.hbs`. Na ação `modify` do `plopfile.mjs`, que registra o módulo no `app.module.ts`, inclua o `.js` no import gerado.
- Os novos scripts `mig:<nome>:*` passam a usar `typeorm-ts-node-esm`.
- Confira que o `dependency-cruiser` resolve `./x.js` para `./x.ts` com o `tsConfig` atual.

**Pronto quando:**

- `npx plop module rascunho` gera um módulo que passa em `typecheck`, `lint`, `format:check`, nos testes e no `arch` sem ajustes, e as migrations dele rodam. Apague o módulo de teste depois.
- Importar algo de `infra` dentro de `domain` ainda faz o `npm run arch` falhar.
- No guia, os trechos de data source, scripts de migration e plop usam ESM (`.js` nos imports, `import.meta.dirname`, `typeorm-ts-node-esm`).

**Extra, feito logo depois da fase** (fora do roteiro original): `esModuleInterop` removido do `tsconfig.json`, porque o `nodenext` já o implica, e aliases `#shared/*`, `#modules/*` e `#test/*` para os imports que cruzam fronteira (311 imports em 130 arquivos). Decisão, condição `@app/source` e armadilhas no [ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md).

**Achado do `/code-review`, corrigido:** no ESM, a auto-instrumentação do OpenTelemetry só enxerga dependências carregadas por `require()`, e os spans do `ioredis` e do `express` sumiam sem erro nem aviso. O `tracing.ts` agora registra o hook ESM do OpenTelemetry (`module.register`), e o `main.ts` carrega o app por `import()` dinâmico (`bootstrap.ts`). Conferido com `OTEL_TRACES_EXPORTER=console`: antes, 0 spans do `ioredis` e do `express`; depois, ambos presentes. Limitação conhecida: o Node 26 imprime `DEP0205` (`module.register` está depreciado) na subida.

---

## Fase 5: módulos com `imports` explícito

> **Status:** ✅ Concluída · **Início:** 2026-11-21 · **Conclusão:** 2026-11-21
>
> - [x] Passo 10: exceção para o arquivo do módulo Nest na regra de fronteira
> - [x] Passo 11: tirar o `@Global` dos módulos de negócio

Contexto e alternativas no [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md).

### Passo 10: exceção para o arquivo do módulo Nest na regra de fronteira

**Por quê:** `CatalogModule`, `InventoryModule` e `IdentityModule` são `@Global` porque a regra `modulos-so-via-contracts` proíbe importar o `*.module.ts` de outro módulo. A doc do Nest diz o contrário: os `exports` de um `@Module` **são** a API pública dele, e o `@Global` é para infraestrutura transversal. Importar um módulo que exporta só a facade não expõe nada além da facade.

**Faça:** em `.dependency-cruiser.js`, a regra continua valendo para todo arquivo, com uma única exceção: um `*.module.ts` pode importar o `*.module.ts` de outro módulo.

```js
{
  name: 'modulos-so-via-contracts',
  severity: 'error',
  from: { path: '^src/modules/([^/]+)/', pathNot: '\\.module\\.ts$' },
  to: {
    path: '^src/modules/[^/]+/',
    pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/contracts/'],
  },
},
{
  // o arquivo do módulo Nest só pode importar, de outro módulo, o contracts/ ou o módulo Nest dele
  name: 'modulo-nest-so-importa-modulo-nest',
  severity: 'error',
  from: { path: '^src/modules/([^/]+)/.+\\.module\\.ts$' },
  to: {
    path: '^src/modules/[^/]+/',
    pathNot: [
      '^src/modules/$1/',
      '^src/modules/[^/]+/contracts/',
      '^src/modules/[^/]+/(infra/)?[^/]+\\.module\\.ts$',
    ],
  },
},
```

**Pronto quando:** o `npm run arch` passa. Ele falha quando um caso de uso, adapter ou controller importa o `*.module.ts` de outro módulo, e também quando um `*.module.ts` importa um arquivo interno de outro módulo.

### Passo 11: tirar o `@Global` dos módulos de negócio

**Por quê:** a dependência passa a aparecer em quem a usa. Quem lê o `OrdersModule` vê que ele depende do catálogo e do estoque.

**Faça:**

- Tire o `@Global` (e o comentário que o justifica) de `catalog.module.ts`, `inventory/infra/inventory.module.ts` e `identity/infra/identity.module.ts`.
- `OrdersModule`: `imports: [CatalogModule, InventoryModule, ...]`. `NotificationsModule`: `imports: [IdentityModule]`.
- O `@Global` continua só na infraestrutura do `shared` (`DatabaseModule`, `ClockModule`, `ObservabilityModule`, `RedisModule` e o módulo do `JwtModule`, passo 12). É o uso que a doc do Nest prevê.
- O inventory continua reagindo ao orders por evento, sem importar o módulo dele. A regra `no-circular` continua valendo.

**Pronto quando:**

- `grep -rn "@Global" src/modules` não encontra nada, `npm run arch` passa sem `forwardRef`, e `test:e2e` passa.
- No guia, a regra `modulos-so-via-contracts` da seção "Qualidade" ganha a exceção do passo 10. O trecho `imports: [InventoryModule]` em "Dependências e contratos entre módulos", que já descrevia o estado-alvo, passa a bater com o código.

---

## Fase 6: autenticação

> **Status:** ✅ Concluída · **Início:** 2026-11-22 · **Conclusão:** 2026-11-23
>
> - [x] Passo 12: `ActorResolver` e ator carregado por requisição
> - [x] Passo 13: access token de 15 minutos
> - [x] Passo 14: refresh token rotativo e logout

Contexto e alternativas no [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md). A base continua sendo o `@nestjs/jwt` (oficial e estável) com o guard próprio.

### Passo 12: `ActorResolver` e ator carregado por requisição

**Por quê:** hoje as roles vão dentro do token (`login.use-case.ts`), e o token vale 1h. Uma role removida ou uma conta apagada continuam valendo até o token expirar. A doc oficial do Nest recomenda não pôr roles nas claims e carregar o usuário a cada requisição.

**Faça:**

- Port no shared, `shared/application/ports/actor-resolver.ts`:

```ts
export abstract class ActorResolver {
  /** O ator atual do usuário, ou null se ele não existir mais (o guard responde 401). */
  abstract resolve(userId: string): Promise<Actor | null>;
}
```

- No identity, `infra/identity-actor-resolver.ts` lê só `id` e `roles` (mais `tenantId`, se existir) por PK. O `IdentityModule` fornece o `ActorResolver` e o exporta junto com a `UserDirectoryFacade`.
- Ligação sem ciclo:
  - `JwtModule.registerAsync` sai do `AuthModule` e vai para um módulo próprio do shared, `@Global`. Ele serve para assinar (identity) e para verificar (guard).
  - O `AuthModule` deixa de ser global. Ele passa a receber o módulo que fornece o `ActorResolver` (`AuthModule.forRoot({ imports: [IdentityModule] })`, chamado no `AppModule`) e registra o `JwtAuthGuard` e o `RolesGuard` como `APP_GUARD`.
  - O shared nunca importa o identity: quem liga os dois é o `AppModule`, a raiz de composição.
- `JwtAuthGuard`: verifica o token, lê o `sub`, chama `resolver.resolve(sub)`, responde 401 se vier `null` e grava o `Actor` em `req.user`. Ele não lê mais `roles` das claims. Atualize o comentário do guard, que hoje diz que ele não consulta a tabela de usuários.
- `LoginUseCase`: o token leva só o `sub`. O `RolesGuard`, o `order-access.ts` e os casos de uso não mudam, porque continuam consumindo o `Actor`.
- Sem cache por enquanto: a busca é uma leitura por PK. Cache só entra se uma medição pedir (passo 18).

**Como ficou:** o adapter se chama `TypeOrmActorResolver` (`identity/infra/typeorm-actor-resolver.ts`), no padrão do `TypeOrmUserDirectoryFacade`, e o módulo do `JwtModule` é o `JwtConfigModule` (`shared/infra/auth/jwt-config.module.ts`). Diferente do que este passo pedia, o `IdentityModule` **não** exporta o `ActorResolver`: isso daria acesso a ele a quem importa o módulo pela facade, o que contraria a ADR 0003. O `ActorResolver` fica num `IdentityAuthModule` próprio, que só o `AppModule` importa (`AuthModule.forRoot({ imports: [IdentityAuthModule] })`). O `tenantId` continua no tipo `Actor`, mas nada o preenche até o projeto ter tenant. No passo 13, considere tirar o `expiresIn` do `JwtConfigModule` e passá-lo no `signAsync` do identity, que é quem precisa devolvê-lo no login. O guard só converte em 401 as falhas do token: se o `ActorResolver` falhar (banco fora do ar), o erro sobe como 500. O helper de e2e `registerAdmin` não faz mais um segundo login, porque a role passa a valer no token já emitido. A seção "Autenticação e ownership" do guia já descreve o `ActorResolver`. O refresh token entra nela no passo 14.

**Pronto quando:**

- O teste unitário do guard, com um `ActorResolver` falso, cobre: token válido com usuário existente, usuário que não existe mais (401) e token adulterado (401).
- No e2e, um admin perde a role direto no banco, e a requisição seguinte com o **mesmo** token recebe 403.
- O `npm run arch` passa, e `shared/` não importa nada de `modules/`.

### Passo 13: access token de 15 minutos

**Por quê:** com o refresh token (passo 14), o access token pode durar pouco. Isso limita o estrago de um token vazado.

**Faça:** troque `JWT_EXPIRES_IN_SECONDS` (padrão 3600) por `JWT_ACCESS_TTL_SECONDS` (padrão 900) no `validateEnv` e no `.env.example`. A resposta do login passa a trazer `expiresIn` em segundos.

**Pronto quando:** o token emitido tem `exp - iat = 900`, e o `validateEnv` recusa a variável antiga com uma mensagem clara.

**Como ficou:** o `expiresIn` saiu do `JwtConfigModule`, que agora só fixa o segredo e o algoritmo. O `TokenIssuer` devolve `{ accessToken, expiresIn }`, que o login repassa sem mapear, e o `JwtTokenIssuer` recebe o TTL pela factory do `IdentityModule` e o passa no `signAsync`. Assim o prazo do token e o prazo informado ao cliente saem do mesmo número. O `validateEnv` tem uma tabela `RENAMED` de variáveis renomeadas: se o ambiente ainda define a antiga, ele falha com `JWT_EXPIRES_IN_SECONDS: renamed to JWT_ACCESS_TTL_SECONDS`, em vez de ignorar o valor sem avisar. Como o `JwtConfigModule` deixou de ter validade padrão, o `JwtAuthGuard` passou a recusar token sem `exp`: o jsonwebtoken só confere a expiração quando ela existe, e um `signAsync` sem `expiresIn` geraria um token eterno (achado do `/code-review`). O passo 14 reaproveita o mesmo `TokenIssuer` no `RefreshSessionUseCase`.

### Passo 14: refresh token rotativo e logout

**Por quê:** com um access token curto, o cliente precisa renovar a sessão sem pedir a senha de novo, e o logout precisa encerrar a sessão de verdade. O modelo segue o que a doc oficial do Nest descreve para o `TokenService`: token opaco, guardado como hash e de uso único. Se um token já usado aparecer de novo, duas partes têm o mesmo token (o cliente e quem o roubou), e toda a família é revogada.

**Faça:**

- Migration no schema `identity`: tabela `refresh_tokens` com `id`, `family_id`, `user_id`, `token_hash` (`UNIQUE`), `created_at`, `expires_at`, `family_expires_at`, `used_at` (nulo) e `revoked_at` (nulo), mais índices em `family_id` e `user_id`.
- O valor do token é `crypto.randomBytes(32).toString('base64url')`, e o banco guarda só o SHA-256 dele. Para um valor aleatório de alta entropia, não é preciso hash lento.
- O domínio do identity concentra as regras: a família tem prazo absoluto, cada token vence e só pode ser usado uma vez. O tempo vem do port `Clock`.
- `LoginUseCase` abre uma família e devolve `{ accessToken, refreshToken, expiresIn }`.
- `POST /v1/auth/refresh` (`@Public()`, com `@Throttle` como o login) chama um `RefreshSessionUseCase`:
  1. Busca o token pelo hash. Se não existir, estiver vencido ou a família estiver revogada, responde 401.
  2. Marca o token como usado com um update condicional: `UPDATE ... SET used_at = :now WHERE id = :id AND used_at IS NULL`. Se afetou 0 linhas, é reuso: revoga a família (`revoked_at` em todos os tokens dela) e responde 401. **A revogação precisa ser confirmada no banco mesmo com o 401.** Faça o caso de uso devolver o resultado e lance o erro depois do `tx.run`, e não dentro dele.
  3. Emite o sucessor na mesma família, com `expires_at = min(agora + TTL, family_expires_at)`, e um novo access token. O ator é carregado do banco, então roles atualizadas já valem.
- `POST /v1/auth/logout` (`@Public()`, recebe o refresh token) revoga a família e responde 204 sempre, mesmo com token desconhecido, para não revelar nada.
- Novas variáveis: `REFRESH_TOKEN_TTL_SECONDS` (padrão 30 dias) e `REFRESH_FAMILY_MAX_AGE_SECONDS` (padrão 90 dias).
- Limpeza das famílias vencidas: um Job Scheduler numa fila `jobs.identity`, como o `ExpirePendingOrdersProcessor`, ligado por `JOBS_ENABLED`.
- Documente as rotas no Swagger.

**Pronto quando:**

- Teste de integração: renovar duas vezes com o mesmo token faz a segunda tentativa receber 401, e o sucessor emitido na primeira também passa a receber 401, porque a família foi revogada.
- Teste de integração: duas renovações simultâneas com o mesmo token resultam em uma só bem-sucedida.
- E2e: login → refresh → chamada autenticada → logout → refresh devolve 401.
- No guia, a seção "Autenticação e ownership" descreve o `ActorResolver`, o token só com `sub` e o refresh token rotativo, no lugar de "os outros módulos nunca consultam a tabela de usuários" com roles no token.

**Como ficou:**

- As colunas seguem a convenção do projeto, em camelCase (`familyId`, `tokenHash`, `usedAt`...), e não em snake_case como este passo listava. A tabela também ganhou uma FK para `identity.users` com `ON DELETE CASCADE`, para que uma conta apagada leve as sessões junto, e um índice em `expiresAt` para a limpeza.
- O `SessionIssuer` (`identity/application/session-issuer.ts`) emite o par de tokens para o login (`start`, abre a família) e para o refresh (`rotate`, sucessor na mesma família). A geração e o hash do valor ficam atrás do port `OpaqueTokenGenerator`, com o `CryptoOpaqueTokenGenerator` na infra. O domínio (`RefreshToken`) calcula os prazos e diz se o token ainda serve. O uso único fica no `markUsed` condicional do repositório, porque é o banco que decide a corrida.
- Duas renovações simultâneas com o mesmo token: uma vence, e a outra revoga a família, inclusive o sucessor da primeira. Isso acontece porque marcar o uso e gravar o sucessor ficam na mesma transação, e a segunda espera a linha ser liberada. Não há janela de tolerância. Se clientes legítimos renovarem em paralelo, avalie uma (passo 18).
- A limpeza apaga os tokens vencidos (`expiresAt`), em lotes de 1000, e não só as famílias vencidas: cada renovação grava uma linha, e um token vencido já é recusado. Um cliente que renova a cada 15 minutos acumularia 96 linhas por dia durante os 90 dias da família.
- Achados do `/code-review`, corrigidos com teste de integração: (1) uma renovação que leu o token antes de um logout ainda emitia sucessor, porque o `markUsed` só olhava o `usedAt`; agora ele exige também `revokedAt` nulo e `expiresAt` futuro. (2) Sob READ COMMITTED, o `UPDATE` da revogação não via o sucessor que uma renovação concorrente tinha gravado e não confirmado. Agora o `revokeFamily` trava a família com `SELECT ... FOR UPDATE` antes do `UPDATE`, e o logout roda numa transação.
- O ciclo de vida dos jobs agendados virou uma base, `ScheduledJobProcessor` (`shared/infra/jobs`). O `ExpirePendingOrdersProcessor` e o novo `PurgeExpiredRefreshTokensProcessor` (fila `jobs.identity`, diário às 3h) só declaram o agendador e chamam o caso de uso.
- O `IdentityModule` passou a importar o `MessagingModule`, pela `BullMqConnection` do job.

---

## Fase 7: Postgres 19

> **Status:** ✅ Concluída · **Início:** 2026-11-23 · **Conclusão:** 2026-11-23
>
> - [x] Passo 15: Postgres 19 no compose e nos testes

### Passo 15: Postgres 19 no compose e nos testes

**Por quê:** o projeto usa a imagem `postgres:17`, e a latest estável é a 19.0 (`postgres:latest`, conferido em 2026-11-21). A partir do 18, a imagem oficial usa `PGDATA=/var/lib/postgresql/<major>/docker` e declara o volume em `/var/lib/postgresql`. Montar o volume no caminho antigo (`/var/lib/postgresql/data`) não funciona.

**Faça:**

- `docker-compose.yml`: `image: postgres:19` e volume em `/var/lib/postgresql`, com um volume novo (por exemplo `pgdata19`), para não misturar com o do 17.
- `test/helpers/database.ts`: `new PostgreSqlContainer('postgres:19')`.
- Dados locais do 17: em desenvolvimento, recrie o banco e rode as migrations e os seeds. Para preservar dados, faça `pg_dumpall` no 17 antes de trocar a imagem e restaure no 19 com `psql`. Um volume do 17 não abre no 19 sem `pg_upgrade`.

**Pronto quando:** `SELECT version()` mostra 19. Num banco vazio, todas as migrations rodam e todo `mig:*:gen` responde que não há mudanças. `test:int` e `test:e2e` passam.

---

## Fase 8: documentação

> **Status:** ✅ Concluída · **Início:** 2026-11-23 · **Conclusão:** 2026-11-23
>
> - [x] Passo 16: `CLAUDE.md`
> - [x] Passo 17: alinhar o guia de referência
> - [x] Passo 18: evoluções sob demanda

### Passo 16: `CLAUDE.md`

**Por quê:** os comandos e as restrições mudaram nas fases 1 a 7.

**Faça:**

- Node 22.13 ou superior (recomendado 24).
- `npm run lint` e `npm run format`, e o `ci` atualizado: typecheck, lint, `format:check`, unitários e arch.
- Vitest: `npm test -- <padrão>` e `npm run test:int -- <padrão>`. Remova o aviso sobre o `--testRegex`.
- Projeto ESM: imports relativos com `.js`, migrations com `typeorm-ts-node-esm`.
- Postgres 19 no compose.
- Rotas `refresh` e `logout`.
- A regra de versões, apontando para a tabela deste plano.

**Pronto quando:** seguir o `CLAUDE.md` do zero (compose, `.env`, migrations, seeds, `start:dev` e os três tipos de teste) funciona sem nenhum passo além dos que estão escritos nele.

**Como ficou:** o `CLAUDE.md` ganhou um setup numerado, os comandos `lint` e `format`, uma seção "Imports (ESM)" (`.js` nos relativos, aliases `#...` entre fronteiras, `import.meta.dirname`, nada de `import type` em classe injetada), uma seção "Autenticação" (rotas, `ActorResolver`, refresh rotativo) e a regra de versões, que aponta para a tabela deste plano. Os itens do Postgres 19 e do Vitest já estavam lá desde as fases 3 e 7. Conferido em 2026-11-23 num banco vazio: as migrations dos cinco módulos e os três seeds rodaram, a app subiu (`/health/live`, `/docs`), e login → refresh → logout → refresh devolveu 401. `ci`, `test:int` e `test:e2e` passaram. Cuidado ao conferir: uma segunda instância da app no mesmo Redis consome as filas do BullMQ e faz o e2e falhar. Encerre outros `start:dev` antes de rodá-lo.

### Passo 17: conferência final do guia de referência

**Por quê:** cada fase atualiza a sua seção do guia. Este passo confere o conjunto. As correções que já valiam para o código de 2026-11-21 foram aplicadas na revisão:

- facade do inventory com resultado;
- `!` com `strict` e `Relation<>`;
- desempate `addOrderBy('o.id')`;
- opções da Keyv para o Redis fora;
- `maxRetriesPerRequest` e `age` em segundos;
- Job Scheduler com `setGlobalConcurrency` e `attempts`;
- `HealthIndicatorService` e `@SkipThrottle`, `dtoFileNameSuffix`;
- limites do OpenTelemetry no Nest 12 e o campo `trace_id`;
- `FOR UPDATE OF o SKIP LOCKED`;
- limite do `version === 0`;
- `no-circular` com `viaOnly`, plop em ESM e `Deprecation` junto com o `Sunset`.

**Faça:** releia os trechos do guia citados pelo roteiro original e pelos passos deste plano. Confira também o que nenhuma fase cobriu, como menções a Postgres 17, Jest ou CommonJS fora das seções já atualizadas.

**Pronto quando:** cada trecho de código do guia compila sob o `tsconfig.json` atual e bate com o código, e nenhum trecho menciona `ts-jest`, `typeorm-ts-node-commonjs` ou `@Global` em módulo de negócio.

**Como ficou:** os termos proibidos já não apareciam. A conferência foi trecho a trecho contra o código, e não por compilação: os trechos são recortes (métodos soltos, `/* ... */`), e compilá-los exigiria completar cada um. Foram corrigidos cerca de 40 pontos que as fases anteriores não alcançaram, a maioria anterior à revisão de 2026-11-21:

- **Árvore de pastas:** saíram o `domain/services` e a `orders.facade.ts`, que não existem. Entraram `catalog/`, `notifications/`, `domain/events/` e o `actor-resolver.ts`.
- **Snippets reescritos a partir do código:**
  - o `txStore` privado, com `currentManager` e `runWithManager`;
  - o `PriceCatalog` por `useFactory`;
  - o data source com `validateEnv`;
  - o handler do inventory com `IdempotentConsumer` e `@IntegrationEventHandler`;
  - o `BullMqPublisher` com `EventSubscriptions` e `allSettled`;
  - o optimistic locking, que agora é o do `Order` (o estoque não tem `version`);
  - o débito atômico com `StockItemOrmEntity`;
  - a listagem com `getRawMany`;
  - o plopfile com a lista `FILES`;
  - as duas regras de alias do dependency-cruiser.
- **Configuração:** o guia ensinava `registerAs`/`ConfigModule.forFeature`, que o projeto não usa. Passou a mostrar o `ConfigService<EnvironmentVariables, true>` no `useFactory` e a tabela `RENAMED`.
- **Fora do guia:** o `.env.example` e o `docker-compose.yml` perderam as notas "fase 12" e o `traceId` (o campo é `trace_id`).

### Passo 18: evoluções sob demanda

Adote estes itens só quando a condição for atendida:

| Condição | O que fazer |
| --- | --- |
| `@nestjs/authentication` e `@nestjs/authorization` chegarem à 1.0 | Reavaliar a troca do guard próprio, do refresh token e do `RolesGuard` pelos pacotes oficiais (o `@nestjs/authorization` nega por padrão com `@Can()`) |
| `@nestjs/cli` e `typescript-eslint` aceitarem o TS 7.1 ou superior | Atualizar o `typescript` e tirar a exceção da tabela |
| O `cache-manager` depender da `keyv` 6 | Atualizar `keyv` e `@keyv/redis` juntos |
| Uma medição mostrar custo no `ActorResolver` | Cache curto no Redis com invalidação por evento quando as roles mudarem |
| O `instrumentation-nestjs-core` suportar o Nest 12 | Reativar os spans de controller |
| Permissões crescerem além de roles | CASL (`@casl/ability`, com receita na doc do Nest) |
| Clientes legítimos perderem a sessão por renovar em paralelo com o mesmo refresh token, ou por repetir a renovação depois de perder a resposta | Janela de tolerância curta no reuso: devolver o sucessor já emitido em vez de revogar a família |
| O `engines` exigir Node `>=22.22.3` (linha 22) ou `>=24.11.1` | Trocar o `module.register` do `tracing.ts` (depreciado, DEP0205) pelo `register` de `import-in-the-middle/register-hooks.mjs`, que usa o `module.registerHooks`. O `import-in-the-middle` hoje é dependência transitiva do `@opentelemetry/instrumentation`: adicione-o ao `package.json` na mesma versão, para que o hook e o `Hook()` do OpenTelemetry usem a mesma instância. Confira que os spans do `ioredis` e do `express` continuam aparecendo |
| Uma regra do `strictTypeChecked` deixada de fora passar a pegar bug real, ou o desenho que a impede mudar | Reavaliar a regra (lista e motivos na ADR 0004) |
| Um acesso por índice sem checagem causar bug, ou a `no-unnecessary-condition` pedir para tirar uma guarda de índice | Ligar o `noUncheckedIndexedAccess` no `tsconfig.json` (29 erros do `tsc` em 2026-11-23, 9 arquivos de teste e 5 de produção) |

**Como ficou (2026-11-23):** o único gatilho atendido era o do lint, limpo desde a fase 2. O resultado e os ajustes que ele pediu estão na ADR 0004. Fora da tabela, o `dependency-cruiser` estava no 18.8 sem exceção registrada e foi para o 18.9.
