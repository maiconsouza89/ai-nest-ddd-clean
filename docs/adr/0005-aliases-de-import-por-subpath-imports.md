---
status: accepted
---

# Aliases de import com `imports` do `package.json`

Imports que **cruzam uma fronteira** usam alias `#...`, em vez de uma escada de `../`. Imports dentro da mesma fronteira continuam relativos, com `.js` (ESM).

| Alias | Aponta para | Quando usar |
| --- | --- | --- |
| `#shared/*` | `src/shared/*` | um módulo (ou `app.module.ts`) importa o shared kernel |
| `#modules/*` | `src/modules/*` | um módulo importa o `contracts/` de outro, ou `app.module.ts` importa um módulo |
| `#test/*` | `test/*` | um spec importa fakes e helpers de `test/`. Só tem a condição `@app/source`, sem `default`, de propósito: `test/` não vai para o `dist` |

Uma "fronteira" é `src/shared`, cada `src/modules/<módulo>` e `test`. Dentro de um módulo, `../domain/x.js` continua certo. O alias não tem `.js` no final: o `package.json` acrescenta a extensão.

Os aliases usam os subpath imports do Node (`imports` no `package.json`), sem plugin de bundler e sem `tsconfig paths`. O `paths` do TypeScript não reescreve o import na saída, e o Node não o entende em runtime.

## Como resolve

Cada alias tem duas saídas, escolhidas por condição:

```json
"#shared/*": {
  "@app/source": "./src/shared/*.ts",
  "default": "./dist/shared/*.js"
}
```

- **Node em produção** (`node dist/main.js`): sem condição extra, cai em `default` e carrega `dist/`.
- **Ferramentas que leem o código-fonte** ativam `@app/source` e carregam `src/`. O nome tem prefixo para não colidir com uma condição `source` de uma dependência. É o mesmo padrão que o próprio repositório do TypeScript usa (`@typescript/source`).

| Ferramenta | Onde a condição é ativada |
| --- | --- |
| `tsc`, ESLint | `customConditions` no `tsconfig.json` |
| Vitest | `ssr.resolve.conditions` no `vitest.config.ts` |
| `dependency-cruiser` | `enhancedResolveOptions.conditionNames` no `.dependency-cruiser.js` |
| migrations e seeds (`ts-node`) | `--conditions=@app/source`, via `NODE_OPTIONS` nos scripts `mig:*` e direto no `node` nos `seed:*` |

## Armadilhas

- **`dependency-cruiser` sem a condição não avisa.** O alias resolve para `dist/`, e as regras de camada e de fronteira deixam de enxergar o import. O `npm run arch` continua verde. Por isso a condição está configurada, e vale conferir com um import proibido de propósito depois de mexer nela.
- **Script sem a condição carrega o `dist/`.** Rodar um data source ou seed sem `--conditions=@app/source` não falha se houver um `dist/` antigo: ele usa o código compilado, que pode estar desatualizado. O `plopfile.mjs` já gera os scripts `mig:*` com a condição.
- **Vitest: não inclua `import` nem `default` em `ssr.resolve.conditions`.** Trocar a lista substitui os padrões do Vite, então eles são repetidos lá (`module`, `node`, `development|production`). Com `import` forçado, o `require('pg')` do TypeORM passa a resolver o build ESM do `pg` e falha com "Postgres package has not been found installed".
- **Sem `.ts` no import.** `import ... from '#shared/x.ts'` dá o erro `TS2877`, porque o TypeScript não reescreve a extensão de um caminho que não é relativo.

## Considered Options

- **`paths` no `tsconfig.json`:** o `tsc` não reescreve o caminho na saída, então seria preciso mais uma ferramenta (`tsc-alias`, `tsconfig-paths` ou um bundler) só para o runtime.
- **Só `default` apontando para `dist/`:** o Vitest e o `tsc` passariam a ler código compilado, possivelmente velho, em vez do fonte.
- **Alias dentro do mesmo módulo também:** esconderia onde a fronteira está e deixaria de ser um sinal de leitura. Quem vê `#shared/...` sabe que o import sai do módulo.
- **Barrels (`index.ts`):** encurtariam os imports, mas trazem de volta o risco de ciclo, que no ESM vira `ReferenceError` na carga, e escondem a dependência real (ADR 0003).
- **Manter os `../../../../`:** funciona, mas 311 imports atravessavam fronteiras com caminhos de até cinco níveis, frágeis a qualquer mudança de pasta.

## Consequências

- Os scripts `mig:*` e `seed:*` ficam mais longos e dependem de `NODE_OPTIONS=...` na frente, sintaxe de shell POSIX.
- O gerador do plop produz imports com alias e scripts com a condição, e registra o módulo novo no `app.module.ts` como `#modules/<nome>/...`.
- A convenção é verificada pelo `npm run arch`: a regra `fronteira-via-alias` barra um `../` que sai do módulo (ou do shared), e a `alias-so-entre-fronteiras` barra um alias que aponta para dentro da própria fronteira. Os specs ficam fora do `arch` (a configuração os exclui), então nos testes a convenção depende de revisão.
- Os arquivos da raiz de `src/` (`app.module.ts`, `app.setup.ts`) não têm alias. Os testes e2e os importam por caminho relativo (`../src/app.module.js`), e isso é intencional.
