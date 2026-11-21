---
status: accepted
---

# Vitest e projeto em ESM

O Nest 12 é distribuído só como ESM. O Jest só carrega esses pacotes com `node --experimental-vm-modules`, que era o contorno usado até aqui. Decidimos trocar o Jest pelo Vitest e migrar o próprio projeto para ESM (`"type": "module"`). Esse é o layout que o `nest new` oferece para ESM, e o Vitest é o runner padrão dele.

O Nest injeta dependências por classe usando decorator metadata. Com o Vite 7 e anteriores o transformador era o esbuild, que não a emite, e por isso a receita oficial (docs.nestjs.com/recipes/swc) manda usar o `unplugin-swc`. O Vitest 5 roda sobre o Vite 8, cujo transformador padrão é o oxc, e ele emite a metadata lendo `experimentalDecorators` e `emitDecoratorMetadata` do `tsconfig.json`. Validamos sem o SWC: unitários, integração e e2e passam, e os e2e sobem o `AppModule` inteiro. Por isso o projeto **não usa SWC**. O `src/shared/testing/decorator-metadata.spec.ts` falha se a metadata deixar de ser emitida.

Limite: o suporte do oxc é parcial. Tipos que exigem inferência (type alias, utility types) viram `Object`, então todo provider deve ser injetado por classe concreta ou `@Inject`. O SWC também não resolve esses casos.

## Considered Options

- **Jest com `--experimental-vm-modules` e projeto CommonJS:** funciona hoje, mas depende de uma flag experimental do Node e do suporte do Jest a ESM, que é o ponto fraco dele.
- **Continuar em CommonJS e usar o Vitest:** a doc do Nest diz que CommonJS continua suportado via `require(esm)`, e essa opção teria evitado mexer em todos os imports. Escolhemos o ESM para alinhar com o layout atual do Nest e não depender do `require(esm)`.

## Consequences

- Imports relativos levam a extensão `.js`, e `__dirname` vira `import.meta.dirname`.
- O CLI do TypeORM passa a rodar com `typeorm-ts-node-esm`, e os seeds com `node --loader ts-node/esm`.
