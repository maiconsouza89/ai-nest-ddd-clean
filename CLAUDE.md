# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Pesquisa de documentação e versões (Context7)

Antes de adicionar, atualizar ou usar qualquer biblioteca, framework ou SDK, **use o Context7** (MCP `context7`: `resolve-library-id` e depois `query-docs`) para consultar a documentação atual. Não confie apenas no conhecimento de treino.

- Verifique a **versão estável mais recente** e a sintaxe/API atual antes de instalar ou escrever código que dependa dela (ex.: NestJS, TypeORM/Prisma, class-validator, Jest).
- Prefira **bibliotecas oficiais** e as recomendadas pela documentação do framework (ex.: pacotes `@nestjs/*`) em vez de alternativas de terceiros, salvo justificativa explícita.
- Ao migrar versões ou corrigir erros específicos de biblioteca, consulte o guia de migração/documentação via Context7 antes de alterar o código.
- Ao propor uma nova dependência, informe a versão consultada e por que ela é a recomendada.
- Se o Context7 não tiver a biblioteca, use a documentação oficial (web) como alternativa e deixe isso claro.

## Comandos

Setup: `docker compose up -d postgres redis` (Postgres 17 em `127.0.0.1:5432` e Redis 8 em `127.0.0.1:6379`). O `.env` precisa existir (copie de `.env.example`, que inclui `REDIS_URL`).

- Dev: `npm run start:dev`
- Build: `npm run build`, depois `node dist/main.js` (não há script `start`)
- Typecheck: `npm run typecheck`
- Regras de arquitetura: `npm run arch`
- `npm run ci` = typecheck + unitários + arch. **Não** roda integração nem e2e.

### Migrations

- Rodar: `npm run mig:<módulo>:run`, para `orders`, `identity`, `catalog`, `inventory` e `outbox`. Não rodam sozinhas ao subir a app.
- Gerar: `npm run mig:<módulo>:gen` (precisa do banco no ar, pois compara com as entidades).

### Seeds (só desenvolvimento)

- `npm run seed:<módulo>`, para `identity`, `catalog` e `inventory`. Só inserem o que falta (não sobrescrevem dados existentes), então podem rodar mais de uma vez, e só rodam com `NODE_ENV=development` ou `test`.
- Rode as migrations antes. Login de teste: `admin@example.com` / `user@example.com`, senha `Senha@12345`.

### Testes

- `npm test`: unitários (`*.spec.ts`), sem banco.
- `npm run test:int`: integração (`*.int-spec.ts`), sobe Postgres e Redis descartáveis via Testcontainers, então exige Docker. Leva cerca de 40s.
- `npm run test:e2e`: e2e (`test/*.e2e-spec.ts`), sobe o app inteiro contra o banco de `DATABASE_URL` e o Redis de `REDIS_URL` (padrão: os mesmos do docker-compose, então os dois precisam estar no ar). **Grava dados nesse banco.**

Um arquivo:

- Unitário: `npm test -- money.vo` (o argumento é um padrão de caminho).
- Integração: `npm run test:int -- --testPathPatterns pay-order`. **Não** passe o caminho direto depois de `test:int`: a flag `--testRegex` do script o engole e a suíte inteira roda.

## Arquitetura (visão geral)

Monólito modular com NestJS, seguindo DDD e Clean Architecture.

- `src/modules/`: módulos de negócio `orders`, `catalog`, `inventory`, `identity` e `notifications`.
- `src/shared/`: kernel compartilhado e infraestrutura transversal.
- `src/app.module.ts`: composição dos módulos. `src/main.ts`: bootstrap.

Os módulos se comunicam pelos seus contratos públicos e por eventos de integração.

Regras de camadas, convenções e decisões de design estão em `docs/`, principalmente `docs/research/modules-ddd-clean-nest.md`.

## Fluxo de entrega

Sempre que a tarefa for uma entrega de implementação (código novo ou alterado), antes de reportar como pronta:

1. Rode a skill `/simplify` sobre as mudanças.
2. Depois rode a skill `/code-review` sobre as mudanças.

Rode nessa ordem. Se julgar que alguma etapa não se aplica, diga qual foi pulada e o motivo na mensagem final.
