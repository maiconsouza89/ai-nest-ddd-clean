# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Pesquisa de documentação e versões (Context7)

Antes de adicionar, atualizar ou usar qualquer biblioteca, framework ou SDK, **use o Context7** (MCP `context7`: `resolve-library-id` e depois `query-docs`) para consultar a documentação atual. Não confie apenas no conhecimento de treino.

- Verifique a **versão estável mais recente** e a sintaxe/API atual antes de instalar ou escrever código que dependa dela (ex.: NestJS, TypeORM/Prisma, class-validator, Vitest).
- Prefira **bibliotecas oficiais** e as recomendadas pela documentação do framework (ex.: pacotes `@nestjs/*`) em vez de alternativas de terceiros, salvo justificativa explícita.
- Ao migrar versões ou corrigir erros específicos de biblioteca, consulte o guia de migração/documentação via Context7 antes de alterar o código.
- Ao propor uma nova dependência, informe a versão consultada e por que ela é a recomendada.
- Se o Context7 não tiver a biblioteca, use a documentação oficial (web) como alternativa e deixe isso claro.

### Regra de versões

Use sempre a **latest estável**. Se a latest de um pacote quebrar outro, use a maior versão compatível e registre o motivo e o gatilho para atualizar na tabela de exceções de `docs/plan/evolucao.md` (seção "Regra de versões"). Hoje estão lá `typescript ~6.0`, `keyv`/`@keyv/redis` 5 e `ioredis` 5. Não atualize esses pacotes sem conferir o gatilho registrado.

## Comandos

Requisitos: Node 22.13 ou superior (`engines`; o `.nvmrc` recomenda o 24) e Docker.

Setup do zero, nesta ordem:

1. `npm install`
2. `cp .env.example .env`
3. `docker compose up -d postgres redis` (Postgres 19 em `127.0.0.1:5432` e Redis 8 em `127.0.0.1:6379`)
4. As migrations de todos os módulos e os seeds (ver abaixo)
5. `npm run start:dev`. A API fica em `http://localhost:3000/v1/...`, o Swagger em `/docs` (fora de `production`) e o health em `/health/live`.

- Dev: `npm run start:dev`
- Build: `npm run build`, depois `node dist/main.js` (não há script `start`)
- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (ESLint com regras que usam tipos, `--max-warnings 0`)
- Formatação: `npm run format` aplica o Prettier, `npm run format:check` só confere
- Regras de arquitetura: `npm run arch`
- `npm run ci` = typecheck + lint + format:check + unitários + arch. **Não** roda integração nem e2e.

### Migrations

- Rodar: `npm run mig:<módulo>:run`, para `orders`, `identity`, `catalog`, `inventory` e `outbox`. Não rodam sozinhas ao subir a app.
- Gerar: `npm run mig:<módulo>:gen` (precisa do banco no ar, pois compara com as entidades).
- Os scripts usam `typeorm-ts-node-esm` com `NODE_OPTIONS=--conditions=@app/source`. Sem essa condição, os aliases `#...` carregam o `dist/`, que pode estar desatualizado, e não dá erro (ADR 0005).

### Seeds (só desenvolvimento)

- `npm run seed:<módulo>`, para `identity`, `catalog` e `inventory`. Só inserem o que falta (não sobrescrevem dados existentes), então podem rodar mais de uma vez, e só rodam com `NODE_ENV=development` ou `test`.
- Rode as migrations antes. Login de teste: `admin@example.com` / `user@example.com`, senha `Senha@12345`.

### Testes

- `npm test`: unitários (`*.spec.ts`), sem banco. `npm run test:watch` roda o mesmo em modo watch.
- `npm run test:int`: integração (`*.int-spec.ts`), sobe Postgres e Redis descartáveis via Testcontainers, então exige Docker. Leva cerca de 75s.
- `npm run test:e2e`: e2e (`test/*.e2e-spec.ts`), sobe o app inteiro contra o banco de `DATABASE_URL` e o Redis de `REDIS_URL` (padrão: os mesmos do docker-compose, então os dois precisam estar no ar). **Grava dados nesse banco.** Encerre qualquer `start:dev` antes: outra instância no mesmo Redis consome as filas do BullMQ e derruba testes.

Um arquivo:

- Unitário: `npm test -- money.vo` (o argumento é um padrão de caminho).
- Integração: `npm run test:int -- pay-order`. Funciona igual para `test:e2e`.

O runner é o Vitest (ADR 0001). Os testes importam `describe`, `it`, `expect` e `vi` de `'vitest'`, sem globals. A decorator metadata que o Nest usa para injetar por classe vem do oxc, o transformador padrão do Vite 8. Se um construtor falhar com "can't resolve dependencies" nos testes, lembre que o oxc usa `Object` para tipos que exigem inferência (type alias, utility types).

### Novo módulo

`npm run plop module <nome>` (nome no singular) gera a estrutura padrão, registra o módulo no `app.module.ts` e cria os scripts de migration. Templates em `plop-templates/module/`. Depois de gerar, rode `npm run mig:<nome>:run` antes de subir a app (as migrations não rodam sozinhas). Rode o gerador na raiz do repositório.

## Arquitetura (visão geral)

Monólito modular com NestJS, seguindo DDD e Clean Architecture.

- `src/modules/`: módulos de negócio `orders`, `catalog`, `inventory`, `identity` e `notifications`.
- `src/shared/`: kernel compartilhado e infraestrutura transversal.
- `src/app.module.ts`: composição dos módulos. `src/main.ts`: entrada, carrega o `tracing.ts` e depois o `bootstrap.ts`.

Os módulos se comunicam pelos seus contratos públicos e por eventos de integração. Um módulo declara de quem depende em `imports`. `@Global` só vale para a infraestrutura do `shared` (ADR 0003).

### Imports (ESM)

O projeto é ESM (`"type": "module"`, ADR 0001):

- Um import relativo leva `.js`, mesmo apontando para um `.ts` (`./money.vo.js`).
- Um import que cruza uma fronteira (`src/shared`, cada `src/modules/<módulo>` e `test`) usa os aliases `#shared/*`, `#modules/*` e `#test/*`, sem extensão. Dentro da mesma fronteira, o import continua relativo (ADR 0005). O `npm run arch` barra as duas violações.
- Use `import.meta.dirname` no lugar de `__dirname`, e `await import()` no lugar de `require()`.
- **Não** ative o `consistent-type-imports` nem troque por `import type` uma classe injetada pelo construtor: a injeção de dependência do Nest quebra em tempo de execução, e o `tsc` não avisa (ADR 0004).

### Autenticação

As rotas são `POST /v1/auth/register`, `login`, `refresh` e `logout`, todas públicas e com throttle. O login devolve `{ accessToken, expiresIn, refreshToken }`, e o access token dura 15 minutos (`JWT_ACCESS_TTL_SECONDS`). O token leva só o `sub`. O `JwtAuthGuard` carrega o ator (id e roles) do banco a cada requisição, pelo port `ActorResolver` (ADR 0002). O refresh token é opaco, rotativo e de uso único. Reusar um token já trocado revoga a sessão inteira. O logout responde 204 sempre.

Regras de camadas, convenções e decisões de design estão em `docs/`, principalmente `docs/research/modules-ddd-clean-nest.md`.

## Fluxo de entrega

Sempre que a tarefa for uma entrega de implementação (código novo ou alterado), antes de reportar como pronta:

1. Rode a skill `/simplify` sobre as mudanças.
2. Depois rode a skill `/code-review` sobre as mudanças.

Rode nessa ordem. Se julgar que alguma etapa não se aplica, diga qual foi pulada e o motivo na mensagem final.
