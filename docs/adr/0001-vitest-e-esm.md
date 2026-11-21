---
status: accepted
---

# Vitest com SWC e projeto em ESM

O Nest 12 é distribuído só como ESM. O Jest só carrega esses pacotes com `node --experimental-vm-modules`, que era o contorno usado até aqui. Decidimos trocar o Jest pelo Vitest e migrar o próprio projeto para ESM (`"type": "module"`). Esse é o layout que o `nest new` oferece para ESM, e o Vitest é o runner padrão dele.

O Vitest usa o esbuild por padrão, e o esbuild não emite decorator metadata, que é o que o Nest usa para injetar dependências por classe. Por isso os testes passam pelo `unplugin-swc`, que lê `experimentalDecorators` e `emitDecoratorMetadata` do `tsconfig.json`, conforme a receita oficial (docs.nestjs.com/recipes/swc). Quem trocar o SWC pelo transformador padrão do Vitest quebra toda injeção por classe nos testes.

## Considered Options

- **Jest com `--experimental-vm-modules` e projeto CommonJS:** funciona hoje, mas depende de uma flag experimental do Node e do suporte do Jest a ESM, que é o ponto fraco dele.
- **Continuar em CommonJS e usar o Vitest:** a doc do Nest diz que CommonJS continua suportado via `require(esm)`, e essa opção teria evitado mexer em todos os imports. Escolhemos o ESM para alinhar com o layout atual do Nest e não depender do `require(esm)`.

## Consequences

- Imports relativos levam a extensão `.js`, e `__dirname` vira `import.meta.dirname`.
- O CLI do TypeORM passa a rodar com `typeorm-ts-node-esm`, e os seeds com `node --loader ts-node/esm`.
