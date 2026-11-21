# Plano de evolução: atualizando o projeto existente

O [roteiro original](passo-a-passo.md) está concluído e não muda. Este plano parte do código atual e aplica as decisões da revisão de 2026-11-21. Nessa revisão, cada fase do roteiro original foi conferida no Context7, no `npm view` e na documentação oficial. Algumas instruções de lá quebram hoje se seguidas do zero, mas o código já contornou quase todas. O que sobrou, e as decisões novas, estão aqui.

Decisões com contexto próprio: [ADR 0001](../adr/0001-vitest-e-esm.md) (Vitest e ESM), [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md) (ator carregado por requisição) e [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md) (imports explícitos entre módulos).

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**, como no roteiro original.
- Uma fase só termina com `npm run ci`, `npm run test:int` e `npm run test:e2e` passando.
- Toda fase que muda código passa por `/simplify` e depois `/code-review` antes de ser marcada (fluxo de entrega do `CLAUDE.md`).
- O [guia de referência](../research/modules-ddd-clean-nest.md) acompanha o código. Os erros que já valiam para o código atual foram corrigidos na revisão. Cada fase atualiza, no próprio "Pronto quando", as seções do guia que ela muda. Assim o guia nunca descreve um código que ainda não existe.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido. A fase fica ✅ com todos os passos marcados.

### Regra de versões

Sempre a **latest estável**. Quando a latest de um pacote quebra a latest de outro, use a maior versão compatível e registre o motivo e o gatilho para atualizar. Exceções vigentes (consultadas em 2026-11-21):

| Pacote | Fica em | Latest | Motivo | Atualize quando |
| --- | --- | --- | --- | --- |
| `typescript` | `~6.0` | 7.0.2 | O TS 7 não expõe a API do compilador. O `dependency-cruiser` 18.8 recusa o TS 7, e o `@nestjs/cli` 12.0.15 depende de `typescript ~6.0.2`. | Os dois aceitarem o TS 7 |
| `keyv`, `@keyv/redis` | `^5.6`, `^5.1` | 6.1.0 | O `cache-manager` 7.2.9 depende de `keyv ^5.6`. Misturar as linhas 5 e 6 deixa duas Keyv no projeto. | O `cache-manager` depender da `keyv` 6 |
| `argon2` | `^0.45` | 0.45.2 | É 0.x, mas tem anos de produção. O Argon2id é o algoritmo nº 1 do OWASP para senhas. | — (exceção à regra "≥ 1.0") |

Pacotes pré-1.0 sem histórico ficam de fora. Exemplo: `@nestjs/authentication` 0.1.7 e `@nestjs/authorization` 0.1.4, lançados em 2026-09 (ver passo 16).

## Mapa

| Fase | O que muda | Dependências | Status |
| --- | --- | --- | --- |
| 1. Base | Node mínimo e dependências na latest | `ioredis` 6, `uuid` 14 | ⬜ |
| 2. Vitest | Jest sai, Vitest com SWC entra | `vitest`, `unplugin-swc`, `@swc/core` | ⬜ |
| 3. ESM | `"type": "module"` e CLIs em ESM | nenhuma | ⬜ |
| 4. Módulos | `imports` explícito no lugar do `@Global` | nenhuma | ⬜ |
| 5. Autenticação | Ator por requisição, access token curto e refresh token rotativo | nenhuma | ⬜ |
| 6. Postgres 19 | Banco na versão estável mais recente | imagem `postgres:19` | ⬜ |
| 7. Documentação | Guia, `CLAUDE.md` e evoluções pendentes | nenhuma | ⬜ |

**Progresso geral:** 0 de 7 fases concluídas · 0 de 16 passos concluídos · **Fase atual:** 1

---

## Fase 1: base

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: Node mínimo declarado
> - [ ] Passo 2: dependências na latest

### Passo 1: Node mínimo declarado

**Por quê:** o roteiro original pedia "Node 20 ou superior", e isso não vale mais. O `dependency-cruiser` 18 exige Node 22 ou superior, o Vitest 5 exige `^22.12 || ^24 || >=26`, e o Nest 12 é distribuído só como ESM, o que exige `require(esm)` sem flag (disponível a partir do 22.12).

**Faça:**

- `"engines": { "node": ">=22.12" }` no `package.json`.
- `.nvmrc` com `24`, a LTS recomendada. O ambiente atual usa o 26, que também serve.

**Pronto quando:** `npm install` em Node 20 avisa sobre `engines`, e em Node 24 instala sem aviso.

### Passo 2: dependências na latest

**Por quê:** em 2026-11-21, só três pacotes estavam fora da latest sem motivo registrado na tabela de exceções: `ioredis` 5.11 (latest 6.0.0), `uuid` 11.1 (latest 14.0.3) e `typescript` (este é exceção). O roteiro original dizia que "o ioredis 6 conflita com o peer do BullMQ", e isso está errado: o `bullmq` 6.7.8 aceita `ioredis >=5` como peer opcional e é testado com o 6.0.0.

**Faça:**

```bash
npm i ioredis@latest uuid@latest
npm i -D typescript@~6.0
```

- O `uuid` 12 em diante é só ESM. Até a fase 3, o projeto ainda é CommonJS e carrega o `uuid` por `require(esm)`. Os scripts de teste atuais já rodam o Jest com `--experimental-vm-modules`, então ele também carrega.
- Revise as opções do `ioredis` 6 usadas em `BullMqConnection` (`maxRetriesPerRequest: null`, `enableOfflineQueue: false`) e em `RedisThrottlerStorage`, conferindo o changelog do 6 no Context7.

**Pronto quando:** `npm outdated` lista só os pacotes da tabela de exceções, e `ci`, `test:int` e `test:e2e` passam.

---

## Fase 2: Jest → Vitest

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 3: Vitest com SWC e três projetos
> - [ ] Passo 4: migrar os testes e remover o Jest

Contexto e alternativas no [ADR 0001](../adr/0001-vitest-e-esm.md).

### Passo 3: Vitest com SWC e três projetos

**Por quê:** os pacotes do Nest 12 são só ESM. O Jest só os carrega com `node --experimental-vm-modules`, que é o ponto fraco dele. O Vitest é o padrão do Nest 12 em projetos ESM. O esbuild, que o Vitest usa por padrão, **não emite decorator metadata**, e é com ela que o Nest injeta dependências por classe. Por isso o SWC entra junto (receita oficial: docs.nestjs.com/recipes/swc).

**Faça:**

```bash
npm i -D vitest unplugin-swc @swc/core
```

Versões consultadas em 2026-11-21: `vitest` 5.1.1, `unplugin-swc` 2.0.0, `@swc/core` 1.16.22.

```ts
// vitest.config.ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC no lugar do esbuild: emite a decorator metadata que o Nest usa para injetar por classe.
  // experimentalDecorators e emitDecoratorMetadata vêm do tsconfig.json.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    setupFiles: ['./test/setup-env.ts'],
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        extends: true,
        test: {
          name: 'int',
          include: ['src/**/*.int-spec.ts'],
          fileParallelism: false, // containers e banco compartilhados
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
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
- Confira no Context7 se `include` e os timeouts por projeto continuam com esses nomes na versão instalada.

**Pronto quando:** `npx vitest run --project unit` roda pelo menos um spec já migrado, e um teste que injeta dependência por classe num `Test.createTestingModule` passa. Esse teste prova que a metadata está sendo emitida.

### Passo 4: migrar os testes e remover o Jest

**Por quê:** os dois runners não devem conviver: cada um tem a própria config e a própria API de mock.

**Faça:**

- Em todo `*.spec.ts`, `*.int-spec.ts` e `*.e2e-spec.ts` (31, 15 e 7 arquivos), importe de forma explícita: `import { describe, it, expect, beforeEach, vi } from 'vitest'`. Não use `globals: true`.
- Troque `jest.fn`, `jest.spyOn`, `jest.useFakeTimers` e afins por `vi.*`. São 8 arquivos com `jest.` hoje.
- No `tsconfig.json`, `"types": ["node"]` (sem `jest`). O TS 6 tem `types: []` como padrão, então a lista continua explícita.
- Remova `jest`, `ts-jest`, `@types/jest` e o `jest.config.js`.
- O `options.exclude` do dependency-cruiser não muda, porque os sufixos `.spec`, `.int-spec` e `.e2e-spec` continuam os mesmos.

**Pronto quando:**

- `ci`, `test:int` e `test:e2e` passam com a mesma contagem de testes de antes, e `grep -rn "jest" src test package.json` não encontra nada.
- No guia, a seção "Qualidade" cita o Vitest com SWC no lugar do Jest.

---

## Fase 3: CommonJS → ESM

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 5: `"type": "module"` e extensões nos imports
> - [ ] Passo 6: migrations e seeds em ESM
> - [ ] Passo 7: plop e dependency-cruiser em ESM

Contexto no [ADR 0001](../adr/0001-vitest-e-esm.md). A doc do Nest diz que migrar para ESM é opcional, porque CommonJS continua suportado via `require(esm)`. A migração foi uma escolha para alinhar o projeto ao layout ESM do `nest new` e ao Vitest.

### Passo 5: `"type": "module"` e extensões nos imports

**Por quê:** com `"module": "nodenext"`, o formato de saída de cada arquivo vem do `package.json`. Basta adicionar `"type": "module"`, e todo `.ts` passa a ser emitido como ESM (guia oficial de migração do Nest 12, seção "Switching your project to ESM").

**Faça:**

- `"type": "module"` no `package.json`. O `tsconfig.json`, o `tsconfig.build.json` e o `nest-cli.json` não mudam, segundo o guia do Nest.
- Corrija os imports relativos que o `tsc` passa a apontar como sem extensão: `./money.vo` vira `./money.vo.js`. Corrija tudo de uma vez, porque a mudança não funciona pela metade.
- Troque `__dirname` por `import.meta.dirname` nos cinco data sources (`orders`, `identity`, `catalog`, `inventory` e `outbox`) e revise os `require(` de `test/throttle.e2e-spec.ts`.
- Relações do TypeORM entre entidades que se importam continuam com `Relation<>` e `import type`. Em ESM, uma referência circular em decorator gera `ReferenceError` na carga.

**Pronto quando:** `npm run typecheck` e `npm run build` passam, e `node dist/main.js` sobe e responde em `/health/live`.

### Passo 6: migrations e seeds em ESM

**Por quê:** o `typeorm-ts-node-commonjs` não carrega arquivos ESM. A doc do TypeORM 1.1 manda usar o `typeorm-ts-node-esm` em projetos ESM.

**Faça:**

- Nos scripts `mig:*:gen` e `mig:*:run`, troque `typeorm-ts-node-commonjs` por `typeorm-ts-node-esm`. Testado em 2026-11-21 com Node 26, TS 6 e ts-node 10.9.2: o CLI carrega o data source e chega à conexão.
- Nos scripts `seed:*`, troque `ts-node <arquivo>` por `node --loader ts-node/esm --no-warnings <arquivo>`. É o mesmo mecanismo que o `typeorm-ts-node-esm` usa por dentro.

**Pronto quando:** num banco vazio, todos os `mig:*:run` e `seed:*` rodam. Cada `mig:*:gen` também roda e responde que não há mudanças.

### Passo 7: plop e dependency-cruiser em ESM

**Por quê:** o gerador precisa gerar código ESM, e as regras de arquitetura precisam continuar resolvendo os imports com extensão `.js`.

**Faça:**

- Templates em `plop-templates/module/`: imports relativos com `.js`, e `import.meta.dirname` no `data-source.hbs`. Na ação `modify` do `plopfile.mjs`, que registra o módulo no `app.module.ts`, inclua o `.js` no import gerado.
- Os novos scripts `mig:<nome>:*` passam a usar `typeorm-ts-node-esm`.
- Confira que o `dependency-cruiser` resolve `./x.js` para `./x.ts` com o `tsConfig` atual.

**Pronto quando:**

- `npx plop module rascunho` gera um módulo que passa em `typecheck`, nos testes e no `arch` sem ajustes, e as migrations dele rodam. Apague o módulo de teste depois.
- Importar algo de `infra` dentro de `domain` ainda faz o `npm run arch` falhar.
- No guia, os trechos de data source, scripts de migration e plop usam ESM (`.js` nos imports, `import.meta.dirname`, `typeorm-ts-node-esm`).

---

## Fase 4: módulos com `imports` explícito

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 8: exceção para o arquivo do módulo Nest na regra de fronteira
> - [ ] Passo 9: tirar o `@Global` dos módulos de negócio

Contexto e alternativas no [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md).

### Passo 8: exceção para o arquivo do módulo Nest na regra de fronteira

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

### Passo 9: tirar o `@Global` dos módulos de negócio

**Por quê:** a dependência passa a aparecer em quem a usa. Quem lê o `OrdersModule` vê que ele depende do catálogo e do estoque.

**Faça:**

- Tire o `@Global` (e o comentário que o justifica) de `catalog.module.ts`, `inventory/infra/inventory.module.ts` e `identity/infra/identity.module.ts`.
- `OrdersModule`: `imports: [CatalogModule, InventoryModule, ...]`. `NotificationsModule`: `imports: [IdentityModule]`.
- O `@Global` continua só na infraestrutura do `shared` (`DatabaseModule`, `ClockModule`, `ObservabilityModule`, `RedisModule` e o módulo do `JwtModule`, passo 10). É o uso que a doc do Nest prevê.
- O inventory continua reagindo ao orders por evento, sem importar o módulo dele. A regra `no-circular` continua valendo.

**Pronto quando:**

- `grep -rn "@Global" src/modules` não encontra nada, `npm run arch` passa sem `forwardRef`, e `test:e2e` passa.
- No guia, a regra `modulos-so-via-contracts` da seção "Qualidade" ganha a exceção do passo 8. O trecho `imports: [InventoryModule]` em "Dependências e contratos entre módulos", que já descrevia o estado-alvo, passa a bater com o código.

---

## Fase 5: autenticação

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 10: `ActorResolver` e ator carregado por requisição
> - [ ] Passo 11: access token de 15 minutos
> - [ ] Passo 12: refresh token rotativo e logout

Contexto e alternativas no [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md). A base continua sendo o `@nestjs/jwt` (oficial e estável) com o guard próprio.

### Passo 10: `ActorResolver` e ator carregado por requisição

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
- Sem cache por enquanto: a busca é uma leitura por PK. Cache só entra se uma medição pedir (passo 16).

**Pronto quando:**

- O teste unitário do guard, com um `ActorResolver` falso, cobre: token válido com usuário existente, usuário que não existe mais (401) e token adulterado (401).
- No e2e, um admin perde a role direto no banco, e a requisição seguinte com o **mesmo** token recebe 403.
- O `npm run arch` passa, e `shared/` não importa nada de `modules/`.

### Passo 11: access token de 15 minutos

**Por quê:** com o refresh token (passo 12), o access token pode durar pouco. Isso limita o estrago de um token vazado.

**Faça:** troque `JWT_EXPIRES_IN_SECONDS` (padrão 3600) por `JWT_ACCESS_TTL_SECONDS` (padrão 900) no `validateEnv` e no `.env.example`. A resposta do login passa a trazer `expiresIn` em segundos.

**Pronto quando:** o token emitido tem `exp - iat = 900`, e o `validateEnv` recusa a variável antiga com uma mensagem clara.

### Passo 12: refresh token rotativo e logout

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

---

## Fase 6: Postgres 19

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 13: Postgres 19 no compose e nos testes

### Passo 13: Postgres 19 no compose e nos testes

**Por quê:** o projeto usa a imagem `postgres:17`, e a latest estável é a 19.0 (`postgres:latest`, conferido em 2026-11-21). A partir do 18, a imagem oficial usa `PGDATA=/var/lib/postgresql/<major>/docker` e declara o volume em `/var/lib/postgresql`. Montar o volume no caminho antigo (`/var/lib/postgresql/data`) não funciona.

**Faça:**

- `docker-compose.yml`: `image: postgres:19` e volume em `/var/lib/postgresql`, com um volume novo (por exemplo `pgdata19`), para não misturar com o do 17.
- `test/helpers/database.ts`: `new PostgreSqlContainer('postgres:19')`.
- Dados locais do 17: em desenvolvimento, recrie o banco e rode as migrations e os seeds. Para preservar dados, faça `pg_dumpall` no 17 antes de trocar a imagem e restaure no 19 com `psql`. Um volume do 17 não abre no 19 sem `pg_upgrade`.

**Pronto quando:** `SELECT version()` mostra 19. Num banco vazio, todas as migrations rodam e todo `mig:*:gen` responde que não há mudanças. `test:int` e `test:e2e` passam.

---

## Fase 7: documentação

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 14: `CLAUDE.md`
> - [ ] Passo 15: alinhar o guia de referência
> - [ ] Passo 16: evoluções sob demanda

### Passo 14: `CLAUDE.md`

**Por quê:** os comandos e as restrições mudaram nas fases 1 a 6.

**Faça:**

- Node 22.12 ou superior (recomendado 24).
- Vitest: `npm test -- <padrão>` e `npm run test:int -- <padrão>`. Remova o aviso sobre o `--testRegex`.
- Projeto ESM: imports relativos com `.js`, migrations com `typeorm-ts-node-esm`.
- Postgres 19 no compose.
- Rotas `refresh` e `logout`.
- A regra de versões, apontando para a tabela deste plano.

**Pronto quando:** seguir o `CLAUDE.md` do zero (compose, `.env`, migrations, seeds, `start:dev` e os três tipos de teste) funciona sem nenhum passo além dos que estão escritos nele.

### Passo 15: conferência final do guia de referência

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

### Passo 16: evoluções sob demanda

Adote estes itens só quando a condição for atendida:

| Condição | O que fazer |
| --- | --- |
| `@nestjs/authentication` e `@nestjs/authorization` chegarem à 1.0 | Reavaliar a troca do guard próprio, do refresh token e do `RolesGuard` pelos pacotes oficiais (o `@nestjs/authorization` nega por padrão com `@Can()`) |
| `dependency-cruiser` e `@nestjs/cli` aceitarem o TS 7 | Atualizar o `typescript` e tirar a exceção da tabela |
| O `cache-manager` depender da `keyv` 6 | Atualizar `keyv` e `@keyv/redis` juntos |
| Uma medição mostrar custo no `ActorResolver` | Cache curto no Redis com invalidação por evento quando as roles mudarem |
| O `instrumentation-nestjs-core` suportar o Nest 12 | Reativar os spans de controller |
| Permissões crescerem além de roles | CASL (`@casl/ability`, com receita na doc do Nest) |
