# ddd-clean-nest

API em NestJS organizada como monólito modular, com DDD e Clean Architecture. Os módulos de negócio (`orders`, `catalog`, `inventory`, `identity` e `notifications`) ficam em `src/modules/`, cada um com as regras de negócio no centro e o framework restrito à infraestrutura. O `src/shared/` guarda o kernel compartilhado e a infraestrutura transversal: banco, cache, filas, autenticação, observabilidade e jobs. Um módulo fala com outro só pelo `contracts/` dele e por eventos de integração, publicados pela outbox, e declara de quem depende em `imports` ([ADR 0003](docs/adr/0003-imports-explicitos-entre-modulos.md)). O `src/app.module.ts` compõe os módulos, e o `src/main.ts` carrega o tracing antes do app.

Stack: NestJS 12 em ESM, TypeORM com Postgres 19, Redis 8 (cache, filas do BullMQ e rate limit), Vitest, pino e OpenTelemetry.

## Requisitos

- Node 22.13 ou superior. O `.nvmrc` recomenda o 24.
- Docker.

Detalhes em [Comandos → Requisitos](docs/reference/comandos.md#requisitos).

## Quickstart

Na raiz do repositório:

1. Instale as dependências: `npm install`. O aviso sobre scripts de instalação não aprovados pode ser ignorado ([Setup do zero](docs/reference/comandos.md#setup-do-zero)).
2. Crie o `.env` a partir do exemplo: `cp .env.example .env`. Cada variável está em [Variáveis de ambiente](docs/reference/variaveis-de-ambiente.md).
3. Suba o Postgres e o Redis: `docker compose up -d postgres redis`.
4. Rode as migrations e os seeds de cada módulo:

   ```sh
   for m in identity catalog inventory orders outbox; do npm run "mig:${m}:run"; done
   for m in identity catalog inventory; do npm run "seed:${m}"; done
   ```

   Ver [Migrations](docs/reference/comandos.md#migrations) e [Seeds](docs/reference/comandos.md#seeds).

5. Suba a API: `npm run start:dev`.
6. Confira: `http://localhost:3000/health/live` responde, e o Swagger abre em `http://localhost:3000/docs`. Os usuários de teste estão em [Seeds](docs/reference/comandos.md#seeds).

O passo a passo completo, com os endereços da app, está em [Comandos → Setup do zero](docs/reference/comandos.md#setup-do-zero).

## Antes de abrir um PR

`npm run ci` roda typecheck, lint, formatação, documentação, testes unitários e regras de arquitetura. Integração e e2e ficam fora. Ver [Comandos → Verificação](docs/reference/comandos.md#verificação) e [Testes](docs/reference/comandos.md#testes).

Uma mudança de comportamento atualiza a página afetada em `docs/`, ou o PR diz por que não precisa.

## Documentação

| Onde | O que tem |
| --- | --- |
| [docs/](docs/README.md) | Índice da documentação, organizada no modelo Diátaxis, e como escrever uma página |
| [docs/how-to/](docs/README.md#how-to) | Passos para tarefas concretas, como gerar uma migration e publicar um evento de integração |
| [docs/explanation/](docs/README.md#explicação) | O porquê do desenho: monólito modular, camadas, persistência, comunicação entre módulos, agregados, consistência e eventos, shared kernel e autenticação |
| [docs/reference/](docs/README.md#referência) | Comandos, variáveis de ambiente, versões, convenções, autenticação, glossário e uma página por módulo |
| [docs/adr/](docs/README.md#decisões-adr) | As decisões de arquitetura e o porquê de cada uma |
| [Guia de módulos com DDD e Clean Architecture](docs/research/modules-ddd-clean-nest.md) | Agregados, eventos, persistência e o resto do desenho que ainda não foi dividido entre os quadrantes |
| [AGENTS.md](AGENTS.md) | Instruções para agentes de código: armadilhas e rotas para `docs/` |
