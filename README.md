# ai-nest-ddd-clean

[![CI](https://img.shields.io/github/actions/workflow/status/maiconsouza89/ai-nest-ddd-clean/ci.yml?branch=main&label=CI)](https://github.com/maiconsouza89/ai-nest-ddd-clean/actions/workflows/ci.yml)
[![Licença](https://img.shields.io/github/license/maiconsouza89/ai-nest-ddd-clean)](LICENSE)
[![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmaiconsouza89%2Fai-nest-ddd-clean%2Fmain%2Fpackage.json&query=$.engines.node&label=node&logo=nodedotjs&logoColor=white)](package.json)
[![NestJS](https://img.shields.io/github/package-json/dependency-version/maiconsouza89/ai-nest-ddd-clean/@nestjs/core?label=NestJS&logo=nestjs)](package.json)
[![TypeScript](https://img.shields.io/github/package-json/dependency-version/maiconsouza89/ai-nest-ddd-clean/dev/typescript?label=TypeScript&logo=typescript&logoColor=white)](package.json)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-DC382D)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-425CC7?logo=opentelemetry&logoColor=white)
![ESM](https://img.shields.io/badge/ESM-F7DF1E?logo=javascript&logoColor=black)
[![Use this template](https://img.shields.io/badge/Use_this_template-2EA44F?logo=github&logoColor=white)](https://github.com/maiconsouza89/ai-nest-ddd-clean/generate)
[![Docs: Diátaxis](https://img.shields.io/badge/Docs-Di%C3%A1taxis-0A66C2)](docs/README.md)

Template de API em NestJS: um monólito modular com DDD e Clean Architecture, em ESM, com a infraestrutura, a autenticação e os e-mails prontos, e três módulos de exemplo.

Cada módulo fica em `src/modules/`, com as regras de negócio no centro e o framework restrito à infraestrutura. Um módulo fala com outro só pelo `contracts/` dele e por eventos de integração, publicados pela outbox, e declara de quem depende em `imports` ([ADR 0003](docs/adr/0003-imports-explicitos-entre-modulos.md)). Stack: NestJS 12, TypeORM com Postgres 19, Redis 8 (cache, filas do BullMQ e rate limit), Vitest, pino e OpenTelemetry.

## O que vem pronto

A base acompanha todo projeto feito do template:

- **`src/shared/`:** banco com transação pelo contexto, cache no Redis, filas do BullMQ, outbox com consumidor idempotente, guards de autenticação por JWT e de roles, observabilidade (tracing do OpenTelemetry e logs do pino com o id do trace), jobs agendados e rate limit.
- **identity:** contas, verificação do e-mail com código, login, sessões com refresh token rotativo e o ator de cada requisição ([referência](docs/reference/modules/identity.md)).
- **notifications:** os e-mails do código de verificação e de boas-vindas, enviados por SMTP a partir dos eventos do identity ([referência](docs/reference/modules/notifications.md)).

## Módulos de exemplo

Mostram, funcionando e testados, os desenhos que a base não mostra. O porquê de ficarem no repositório está na [ADR 0008](docs/adr/0008-projeto-template-com-modulos-de-exemplo.md).

- **orders:** agregado com itens, outbox e concorrência ([referência](docs/reference/modules/orders.md)).
- **catalog:** CRUD direto, sem as camadas ([referência](docs/reference/modules/catalog.md)).
- **inventory:** reserva síncrona dentro da transação do pedido ([referência](docs/reference/modules/inventory.md)).

A base não depende deles. Para ficar só com ela, siga [Como remover os módulos de exemplo](docs/how-to/remover-os-modulos-de-exemplo.md).

## Usar como template

1. Crie o seu repositório pelo botão **Use this template**, no topo da página do GitHub.
2. Renomeie o projeto: o `name` do `package.json` (depois rode `npm install`, para o `package-lock.json` acompanhar) e o `OTEL_SERVICE_NAME` do `.env.example` e de [Variáveis de ambiente](docs/reference/variaveis-de-ambiente.md). O título do Swagger fica em `src/shared/infra/http/swagger.setup.ts`, e o `maiconsouza89/ai-nest-ddd-clean` dos badges, no topo deste README. Troque também o `author` e o `description` do `package.json`, e a descrição do repositório no GitHub (About). O `LICENSE` mantém o aviso do template, como pede a MIT, e pode ganhar a sua linha de copyright.
3. Troque o dono do `.github/CODEOWNERS` e, no `.github/SECURITY.md`, o escopo. Num repositório privado, o GitHub não oferece o relato privado de vulnerabilidade: ponha outro canal, como um e-mail.
4. Configure o repositório: `npm run github:setup`, com o `gh` autenticado e admin no repositório. Ele exige os checks `ci`, `dependency-review` e `verify-lockfile` e a análise do CodeQL na branch padrão, deixa o merge só por squash com o título do PR no commit, liga os Dependabot alerts e security updates, exige action fixada por SHA e, em repositório público, liga o relato privado de vulnerabilidade. A política "Require lockfile" fica à mão ([Comandos → CI](docs/reference/comandos.md#ci)).
5. Remova os exemplos, se não forem servir de modelo, e crie o primeiro módulo seu: [Como criar um módulo](docs/how-to/criar-um-modulo.md).

## Requisitos

- Node 22.22.3 ou superior na linha 22, ou 24.11.1 ou superior. O `.nvmrc` recomenda o 24.
- Docker.

Detalhes em [Comandos → Requisitos](docs/reference/comandos.md#requisitos).

## Quickstart

Na raiz do repositório:

1. Instale as dependências: `npm install`. O aviso sobre scripts de instalação não aprovados pode ser ignorado ([Setup do zero](docs/reference/comandos.md#setup-do-zero)).
2. Crie o `.env` a partir do exemplo: `cp .env.example .env`. Cada variável está em [Variáveis de ambiente](docs/reference/variaveis-de-ambiente.md).
3. Suba o Postgres, o Redis e o Mailpit: `docker compose up -d postgres redis mailpit`. Os e-mails da app, como o código de verificação, aparecem em <http://localhost:8025>.
4. Rode as migrations e os seeds de cada módulo:

   ```sh
   npm run db:setup
   npm run db:seed
   ```

   Ver [Migrations](docs/reference/comandos.md#migrations) e [Seeds](docs/reference/comandos.md#seeds).

5. Suba a API: `npm run start:dev`.
6. Confira: `http://localhost:3000/health/live` responde, e o Swagger abre em `http://localhost:3000/docs`. Os usuários de teste estão em [Seeds](docs/reference/comandos.md#seeds).

O passo a passo completo, com os endereços da app, está em [Comandos → Setup do zero](docs/reference/comandos.md#setup-do-zero).

## Deploy

A imagem Docker, as migrations num passo antes da app e o teste local com o profile `prod`: [Como fazer o deploy](docs/how-to/fazer-o-deploy.md).

## Contribuir

O fluxo, o formato dos commits, a versão e o que conferir antes do PR estão em [Como contribuir](.github/CONTRIBUTING.md).

## Documentação

| Onde | O que tem |
| --- | --- |
| [docs/](docs/README.md) | Índice da documentação, organizada no modelo Diátaxis, e como escrever uma página |
| [docs/tutorials/](docs/README.md#tutoriais) | Do clone ao primeiro pedido pago pela API |
| [docs/how-to/](docs/README.md#how-to) | Passos para tarefas concretas, como criar um módulo, remover os módulos de exemplo, gerar uma migration, publicar um evento de integração, paginar uma listagem, cachear uma leitura, agendar um job, rodar um teste específico, resetar o ambiente local e fazer o deploy |
| [docs/explanation/](docs/README.md#explicação) | O porquê do desenho: monólito modular, camadas, persistência, comunicação entre módulos, agregados, consistência e eventos, modelagem do domínio, Redis e cache, serviços externos, shared kernel, autenticação e observabilidade |
| [docs/reference/](docs/README.md#referência) | Comandos, variáveis de ambiente, versões, convenções, testes, operação, autenticação, glossário e uma página por módulo |
| [docs/adr/](docs/README.md#decisões-adr) | As decisões de arquitetura e o porquê de cada uma |
| [AGENTS.md](AGENTS.md) | Instruções para agentes de código: armadilhas e rotas para `docs/` |
| [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) | Como contribuir: fluxo, commits, versão e verificação |
| [.github/SECURITY.md](.github/SECURITY.md) | Como reportar uma vulnerabilidade |
