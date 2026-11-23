# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Pesquisa de documentação e versões (Context7)

Antes de adicionar, atualizar ou usar qualquer biblioteca, framework ou SDK, **use o Context7** (MCP `context7`: `resolve-library-id` e depois `query-docs`) para consultar a documentação atual. Não confie apenas no conhecimento de treino.

- Verifique a **versão estável mais recente** e a sintaxe/API atual antes de instalar ou escrever código que dependa dela (ex.: NestJS, TypeORM/Prisma, class-validator, Vitest).
- Ao migrar versões ou corrigir erros específicos de biblioteca, consulte o guia de migração/documentação via Context7 antes de alterar o código.
- Se o Context7 não tiver a biblioteca, use a documentação oficial (web) como alternativa e deixe isso claro.

A regra de versões (sempre a latest estável, bibliotecas oficiais primeiro) e a tabela de exceções estão em `docs/reference/versoes-e-excecoes.md`. Não atualize um pacote da tabela sem conferir o gatilho registrado.

## Referência

Leia a página antes de agir no assunto:

- Comandos, setup do zero, testes, migrations, seeds, geradores do plop e como baixar o ambiente: `docs/reference/comandos.md`
- Variáveis de ambiente: `docs/reference/variaveis-de-ambiente.md`
- Imports ESM, aliases `#...` e `import type`: `docs/reference/convencoes.md`
- Rotas de autenticação, tokens e rotas protegidas: `docs/reference/autenticacao.md`

Para baixar o ambiente, use só `docker compose down -v --remove-orphans` na raiz deste repo. Nunca use `docker volume prune`, `docker system prune` nem remova volumes, containers ou redes de outros projetos.

## Arquitetura (visão geral)

Monólito modular com NestJS, seguindo DDD e Clean Architecture.

- `src/modules/`: módulos de negócio `orders`, `catalog`, `inventory`, `identity` e `notifications`.
- `src/shared/`: kernel compartilhado e infraestrutura transversal.
- `src/app.module.ts`: composição dos módulos. `src/main.ts`: entrada, carrega o `tracing.ts` e depois o `bootstrap.ts`.

Os módulos se comunicam pelos seus contratos públicos e por eventos de integração. Um módulo declara de quem depende em `imports`. `@Global` só vale para a infraestrutura do `shared` (ADR 0003).

Regras de camadas, convenções e decisões de design estão em `docs/`, principalmente `docs/research/modules-ddd-clean-nest.md`.

## Fluxo de entrega

Sempre que a tarefa for uma entrega de implementação (código novo ou alterado), antes de reportar como pronta:

1. Rode a skill `/simplify` sobre as mudanças.
2. Depois rode a skill `/code-review` sobre as mudanças.

Rode nessa ordem. Se julgar que alguma etapa não se aplica, diga qual foi pulada e o motivo na mensagem final.
