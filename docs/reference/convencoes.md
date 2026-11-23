---
type: reference
---

# Convenções

## Imports (ESM)

O projeto é ESM (`"type": "module"`, [ADR 0001](../adr/0001-vitest-e-esm.md)).

### Relativos e aliases

Uma fronteira é `src/shared`, cada `src/modules/<módulo>` e `test`.

| Import | Forma | Exemplo |
| --- | --- | --- |
| Dentro da mesma fronteira | Relativo, com `.js` mesmo apontando para um `.ts` | `import { Money } from './money.vo.js'` |
| Cruzando uma fronteira | Alias, sem extensão | `import { Clock } from '#shared/application/ports/clock'` |

| Alias | Aponta para |
| --- | --- |
| `#shared/*` | `src/shared/*` |
| `#modules/*` | `src/modules/*`. Um módulo só importa o `contracts/` de outro |
| `#test/*` | `test/*`. Só para os testes: `test/` não vai para o `dist/` |

O `npm run arch` barra um `../` que sai da fronteira e um alias que aponta para dentro dela. Os specs ficam fora do `arch`, então nos testes a convenção depende de revisão.

Os arquivos da raiz de `src/` (`app.module.ts`, `app.setup.ts`) não têm alias. Os testes e2e os importam por caminho relativo (`../src/app.module.js`).

Como os aliases resolvem para `src/` ou `dist/`, e a condição `@app/source` que cada ferramenta precisa, está na [ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md).

### APIs do CommonJS

| Em vez de | Use |
| --- | --- |
| `__dirname` | `import.meta.dirname` |
| `require()` | `await import()` |

### `import type`

**Não** transforme em `import type` uma classe injetada pelo construtor, e não ative a regra `consistent-type-imports`. Com o `import type`, a classe some da decorator metadata, e a injeção de dependência do Nest quebra em tempo de execução. O `tsc` não avisa ([ADR 0004](../adr/0004-lint-e-formatacao.md)).
