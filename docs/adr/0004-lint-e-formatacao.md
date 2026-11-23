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

Reavaliação de 2026-11-23: as duas continuam desligadas. Religadas, as `no-unsafe-*` dariam 109 erros nos testes, todos vindos de `res.body`, `ds.query` e matchers, e o `require-await` daria 46, todos em fakes que implementam portas assíncronas. O override do `unbound-method` nos testes saiu: com o Vitest, ele não dispara mais.

## Regras do `strictTypeChecked`

O config continua no `recommendedTypeChecked` e liga, uma a uma, as regras do `strictTypeChecked` que pegam bug sem brigar com o desenho do projeto. Medição de 2026-11-23, com o `strictTypeChecked` inteiro: 307 erros em 9 regras.

Ligadas:

| Regra | Por quê |
| --- | --- |
| `no-deprecated` | Com a regra de versões (sempre a latest), uma API depreciada aparece no lint antes de sumir numa major |
| `no-misused-spread` | O spread de uma instância perde o protótipo da classe sem avisar |
| `use-unknown-in-catch-callback-variable` | O que chega num `.catch()` não é necessariamente um `Error` |
| `no-unnecessary-condition` | Um `?.` ou um `if` que nunca muda o resultado esconde um tipo errado ou código morto. Desligada nos testes: o `afterAll` usa `?.` em variáveis que o `beforeAll` pode não ter preenchido, e o tipo delas é usado sem checagem no resto do arquivo |
| `no-non-null-assertion` | Não havia nenhum `!` em produção, e a regra mantém assim. Desligada nos testes: um `!` depois de um `findById` vira teste vermelho, que é o que se quer |

**Cuidado com a `no-unnecessary-condition` em acesso por índice:** o `noUncheckedIndexedAccess` está desligado, então `arr[i]` e a desestruturação de arrays são tipados como nunca `undefined`. Nesses casos, um `?.` apontado como desnecessário pode ser uma guarda real. Confira o valor em tempo de execução antes de tirar a guarda. O gatilho para ligar o `noUncheckedIndexedAccess` está no passo 18 do plano.

Na adoção, as regras pediram quatro ajustes em produção: o spread de uma instância do TypeORM no `TypeOrmOrderRepository`, que passou a alterar a própria instância; dois `?.` sem efeito, no `JwtAuthGuard` (o `split` sempre devolve ao menos um elemento) e no `TypeOrmUserRepository` (o `QueryFailedError` sempre traz o `driverError`); e um `.catch()` tipado como `Error`. O `module.register` do `tracing.ts` ficou com um `eslint-disable` que aponta para o gatilho do passo 18.

De fora:

- **`no-unsafe-class-instance-assignment`** (171 erros): as portas são classes abstratas, porque o Nest injeta por classe, e os fakes e os `useValue` são objetos literais que as satisfazem pela forma. A regra proíbe exatamente esse padrão.
- **`no-extraneous-class`** (22): pega os `@Module` vazios do Nest e os mappers só com métodos estáticos, que são convenção do projeto.
- **`restrict-template-expressions`** na versão estrita (22): proíbe número em template string. Fica a configuração do `recommendedTypeChecked`.
- **`no-confusing-void-expression`** (21): estilo (`() => fn()` com retorno `void`), sem bug envolvido.

## Considered Options

- **`strictTypeChecked` desde o início:** gera ruído demais na primeira passada. Endurecer regra por regra depois é mais barato.
- **`consistent-type-imports`:** com `emitDecoratorMetadata`, transformar em `import type` uma classe injetada pelo construtor quebra a injeção de dependência do Nest em tempo de execução, e o `tsc` não avisa.
- **`eslint-plugin-boundaries` ou `no-restricted-imports` para as fronteiras:** duplicariam o dependency-cruiser.
