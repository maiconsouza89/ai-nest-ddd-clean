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

## Versionamento da API HTTP

A versão vai no início do caminho (`/v1/orders`), pelo versionamento nativo do Nest, ligado no `configureApp` (`src/app.setup.ts`):

```ts
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

| Regra | Detalhe |
| --- | --- |
| Versão padrão | Um controller sem `version` responde em `/v1/...`. A app não tem prefixo global. Se tiver, a versão vem depois dele |
| Rotas técnicas sem versão | `@Controller({ path: 'health', version: VERSION_NEUTRAL })` |
| A versão é da infra | Uma v2 tem controller e DTOs HTTP próprios (`@Controller({ path: 'orders', version: '2' })`) e chama os mesmos casos de uso da v1 |
| Mudança aditiva | Um campo opcional novo na resposta fica na mesma versão |
| Mudança que quebra | Versão nova, mantendo a anterior até os clientes migrarem. As respostas da antiga avisam o fim com os headers `Deprecation` (RFC 9745) e `Sunset` (RFC 8594) |

## TypeORM

Cada agregado tem uma entidade de domínio e uma ORM entity, convertidas por um mapper. O porquê está em [Persistência](../explanation/persistencia.md).

| Regra | Detalhe |
| --- | --- |
| A ORM entity não sai do repositório concreto | O repositório recebe e devolve a entidade de domínio. O mapper usa `restore` no `toDomain` |
| Id gerado pelo domínio | `@PrimaryColumn('uuid')`, não `@PrimaryGeneratedColumn` |
| `createdAt` e `updatedAt` só na ORM entity | `@CreateDateColumn` e `@UpdateDateColumn` são detalhe técnico e não vão para o domínio |
| `bigint` e `numeric` são `string` | O driver `pg` não converte inteiros de 64 bits para `number`, porque haveria perda de precisão. Tipe a coluna como `string` e converta no mapper |
| Filhos do agregado com `cascade` e `orphanedRowAction` | `cascade: true` no `@OneToMany` da raiz e `orphanedRowAction: 'delete'` no `@ManyToOne` do filho. Sem o `orphanedRowAction`, um item removido do array não é apagado no `save()` |
| Filho com chave composta | `orderId` e `productId` como `@PrimaryColumn`: o `save()` atualiza o item existente em vez de apagar e inserir de novo |
| `!` nas colunas | Com `strict`, as propriedades preenchidas pelo TypeORM levam `!` |
| Relação nos dois sentidos sem ciclo de import | O lado `@ManyToOne` usa o alvo por nome (string) e `import type`. O `Relation<>` impede que o `emitDecoratorMetadata` grave uma referência à classe |

```ts
// order.orm-entity.ts
@OneToMany(() => OrderItemOrmEntity, (item) => item.order, { cascade: true })
items!: Relation<OrderItemOrmEntity[]>;

// order-item.orm-entity.ts
import type { Relation } from 'typeorm';
import type { OrderOrmEntity } from './order.orm-entity.js';

@ManyToOne('OrderOrmEntity', (order: OrderOrmEntity) => order.items, {
  onDelete: 'CASCADE',
  orphanedRowAction: 'delete',
})
@JoinColumn({ name: 'orderId' })
order!: Relation<OrderOrmEntity>;
```
