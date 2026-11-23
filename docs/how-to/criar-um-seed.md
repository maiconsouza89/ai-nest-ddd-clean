---
type: how-to
---

# Como criar um seed

Use este guia para dar a um módulo dados de desenvolvimento e teste manual, como os usuários do identity e os produtos do catalog. Dados que o sistema precisa para funcionar em qualquer ambiente (um tipo fixo, uma categoria padrão) não são seed: vão numa migration ([Como gerar uma migration](gerar-uma-migration.md)), porque o seed não roda em produção.

## Pré-requisitos

- As migrations do módulo aplicadas: `npm run mig:<módulo>:run`.
- O DataSource da CLI do módulo, `<módulo>.data-source.ts`, com as entidades que o seed grava. O `plop module` já o cria.

## Passos

1. Escreva a função do seed em `infra/database/typeorm/seeds/<módulo>.seed.ts`. Num módulo sem camadas, como o catalog, a pasta é `database/seeds/`:

   ```ts
   // Mesmos ids do seed do catalog (módulos só se conhecem por id).
   export const SEED_STOCK = [
     { productId: '11111111-1111-4111-8111-111111111111', available: 50 },
     // ...
   ];

   export async function seedInventory(ds: DataSource): Promise<void> {
     // insere só o que falta: rodar de novo não restaura estoque já consumido
     await ds
       .getRepository(StockItemOrmEntity)
       .createQueryBuilder()
       .insert()
       .values(SEED_STOCK)
       .orIgnore()
       .execute();
   }
   ```

   - **Ids fixos:** escreva os ids no seed. Um dado que outro módulo referencia usa o mesmo id nos dois seeds, como os produtos do catalog e o saldo do inventory.
   - **`orIgnore()`:** vira `ON CONFLICT DO NOTHING`. O seed pode rodar de novo sem duplicar nem sobrescrever o que alguém editou no banco local.

2. Crie o executável `run.ts` na mesma pasta. O `runSeed` do `shared` recusa rodar fora de `development` e `test`, abre e fecha a conexão e marca o exit code em caso de erro:

   ```ts
   import dataSource from '../inventory.data-source.js';
   import { runSeed } from '#shared/infra/database/run-seed';
   import { seedInventory } from './inventory.seed.js';

   void runSeed(dataSource, seedInventory);
   ```

3. Acrescente o script ao `package.json`, com a condição `@app/source`. Sem ela, os aliases `#...` carregam o `dist/`, que pode estar velho:

   ```json
   "seed:inventory": "node --conditions=@app/source --loader ts-node/esm --no-warnings src/modules/inventory/infra/database/typeorm/seeds/run.ts"
   ```

4. Inclua o módulo no loop de seeds do setup, no `README.md` e em `docs/reference/comandos.md` (seções "Setup do zero" e "Seeds"). A ordem do loop segue as referências entre os dados.

5. Descreva o que o seed cria na seção "Schema e migrations" da doc do módulo, em `docs/reference/modules/<módulo>.md`, como faz o [inventory](../reference/modules/inventory.md#schema-e-migrations).

## Como verificar

- `npm run seed:<módulo>` termina com exit 0, e os dados aparecem no banco.
- Rodado de novo, termina com exit 0 sem duplicar linhas e sem desfazer uma mudança feita à mão.
- `NODE_ENV=production npm run seed:<módulo>` recusa com "Seeds de desenvolvimento só rodam com NODE_ENV=development ou test." e exit 1.

## Veja também

- [Comandos](../reference/comandos.md#seeds): os seeds existentes e os usuários de teste.
- [Como gerar uma migration](gerar-uma-migration.md): para dados obrigatórios.
