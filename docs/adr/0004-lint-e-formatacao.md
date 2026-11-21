---
status: accepted
---

# Prettier formata e ESLint com tipos pega bugs, sem sobreposição

O projeto passa a ter um formatador (Prettier) e um linter (ESLint com `typescript-eslint` e informação de tipo). Cada ferramenta tem uma responsabilidade, e nenhuma repete o trabalho de outra:

| Ferramenta | Responsável por |
| --- | --- |
| `tsc --noEmit` | tipos |
| dependency-cruiser | fronteiras entre módulos e camadas ([ADR 0003](0003-imports-explicitos-entre-modulos.md)) |
| ESLint + `typescript-eslint` | bugs que compilam: promises, `any` inseguro, código morto |
| Prettier | formatação |

O ESLint **não** cuida das fronteiras entre módulos. As regras de import ficam só no dependency-cruiser, para não terem duas fontes de verdade.

O `eslint-config-prettier` só desliga as regras de estilo do ESLint. O `eslint-plugin-prettier` (usado pelo template do `nest new`) roda o Prettier como regra de lint, o que é mais lento e mostra formatação como erro. A doc do `typescript-eslint` desaconselha isso.

## Regras desligadas na adoção

O config parte do `recommendedTypeChecked`. Duas famílias de regras ficam desligadas, cada uma em um bloco do `eslint.config.mjs` que aponta para esta ADR:

- **`no-unsafe-*` nos testes** (`*.spec.ts`, `*.int-spec.ts` e `test/`): o supertest devolve `res.body` como `any`, os matchers do Vitest (`expect.objectContaining`) também, e `ds.query` cru idem. No código de produção as regras continuam ligadas.
- **`require-await` nos testes, nos repositórios em memória (`in-memory/`) e nos adaptadores simulados (`simulated-payment.gateway.ts`, `logging-email-sender.ts`)**: eles implementam portas que devolvem `Promise`. O `async` sem `await` é intencional, porque uma exceção síncrona vira rejeição, como no adaptador real. As regras que pegam bug de verdade (`no-floating-promises`, `no-misused-promises`, `await-thenable`) continuam ligadas.

Não se usa `warn`: com `--max-warnings 0` ele é só um erro adiado. As duas famílias acima são reavaliadas no passo 18 do [plano de evolução](../plan/evolucao.md).

## Considered Options

- **`strictTypeChecked` desde o início:** gera ruído demais na primeira passada. Endurecer regra por regra depois é mais barato.
- **`consistent-type-imports`:** com `emitDecoratorMetadata`, transformar em `import type` uma classe injetada pelo construtor quebra a injeção de dependência do Nest em tempo de execução, e o `tsc` não avisa.
- **`eslint-plugin-boundaries` ou `no-restricted-imports` para as fronteiras:** duplicariam o dependency-cruiser.
