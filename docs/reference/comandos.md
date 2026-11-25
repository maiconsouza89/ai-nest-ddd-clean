---
type: reference
---

# Comandos

Todos os comandos rodam na raiz do repositório.

## Requisitos

- Node 22.22.3 ou superior (`engines` do `package.json`). O `.nvmrc` recomenda o 24.
- Docker, para o Postgres, o Redis e o Mailpit do `docker-compose.yml` e para os testes de integração.

## Setup do zero

Nesta ordem:

1. `npm install`. O npm pode avisar que pacotes como `argon2` e `ssh2` têm scripts de instalação não aprovados. O setup funciona sem aprová-los: o `argon2` usa um binário pronto (conferido em 2026-11-23, com o npm 11.20 e o Node 26).
2. `cp .env.example .env`. Cada variável está em [Variáveis de ambiente](variaveis-de-ambiente.md).
3. `docker compose up -d postgres redis mailpit`. Sobe o Postgres 19 em `127.0.0.1:5432`, o Redis 8 em `127.0.0.1:6379` e o Mailpit 1, o SMTP de desenvolvimento, em `127.0.0.1:1025`.
4. As [migrations](#migrations) de todos os módulos, depois os [seeds](#seeds):

   ```sh
   npm run db:setup
   npm run db:seed
   ```

5. `npm run start:dev`.

Com a app no ar:

| Endereço | O que é |
| --- | --- |
| `http://localhost:3000/v1/...` | API, versionada na URL |
| `http://localhost:3000/docs` | Swagger. Só existe fora de `NODE_ENV=production` |
| `http://localhost:3000/health/live` | O processo está vivo. Não consulta dependências |
| `http://localhost:3000/health/ready` | O banco e o Redis respondem |
| `http://localhost:8025` | Mailpit: os e-mails que a app enviou, como o código de verificação. Nada sai para fora. A API do Mailpit, que o e2e usa, fica em `/api/v1` |

O health não tem versão na URL, não pede token e fica fora do rate limit. O que cada endereço confere e responde está em [Operação](operacao.md).

## Desenvolvimento e build

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run build` | Compila para `dist/`. Para rodar o build: `node dist/main.js`. Não há script `start` |

## Verificação

| Comando | O que faz |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint com regras que usam tipos, `--max-warnings 0` ([ADR 0004](../adr/0004-lint-e-formatacao.md)) |
| `npm run format` | Aplica o Prettier. O Markdown fica fora ([ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md)) |
| `npm run format:check` | Só confere a formatação |
| `npm run arch` | Regras de camadas e de fronteiras entre módulos, com o dependency-cruiser (`.dependency-cruiser.js`) |
| `npm run docs:check` | Lint do Markdown, links e âncoras locais, `type:` das páginas de `docs/` e comentários de template que sobraram. Também confere que cada pasta de `src/modules/` está no índice de módulos do `docs/README.md` e que cada página de módulo tem um módulo; que o `AGENTS.md` não usa `@caminho`; e que os caminhos de `docs/` citados no `AGENTS.md` e nos arquivos de `.claude/` existem (`scripts/remark-docs-rules.mjs`) |
| `npm run docs:links` | Links externos, com o lychee via Docker. Pula os endereços locais (`localhost`), que só respondem com a app ou o compose no ar. Fora do CI, porque depende da rede |
| `npm run ci:static` | `typecheck`, `lint`, `format:check`, `docs:check` e `arch`, nessa ordem. É o job `check` do CI |
| `npm run ci` | `ci:static` e depois `test`. **Não** roda integração nem e2e |

## Testes

| Comando | O que roda |
| --- | --- |
| `npm test` | Unitários (`*.spec.ts`), sem banco |
| `npm run test:watch` | Os unitários em modo watch |
| `npm run test:int` | Integração (`*.int-spec.ts`). Sobe um Postgres e um Redis descartáveis com o Testcontainers para a execução inteira, então exige Docker. Os arquivos rodam em paralelo, cada um no seu banco ([Testes](testes.md#convenções)) |
| `npm run test:e2e` | E2E (`test/*.e2e-spec.ts`). Sobe o app inteiro contra o banco de `DATABASE_URL`, o Redis de `REDIS_URL` e o SMTP de `SMTP_URL`, e lê os e-mails pela API do Mailpit |

O runner, o `test/setup-env.ts`, a decorator metadata e qual tipo de teste cobre cada camada estão em [Testes](testes.md).

Para rodar um arquivo só, passe um padrão de caminho depois do `--`. O filtro por nome e por linha está em [Como rodar um teste específico](../how-to/rodar-um-teste-especifico.md).

- `npm test -- money.vo`
- `npm run test:int -- pay-order`
- `npm run test:e2e -- auth`

Cuidados com o e2e:

- Por padrão, `DATABASE_URL`, `REDIS_URL` e `SMTP_URL` apontam para o Postgres, o Redis e o Mailpit do `docker-compose.yml`. Os três precisam estar no ar. O endereço da API do Mailpit muda com `MAILPIT_API_URL` (padrão `http://127.0.0.1:8025`).
- O e2e **grava dados** nesse banco.
- Encerre qualquer `start:dev` antes. Outra instância no mesmo Redis consome as filas do BullMQ e derruba os testes.

## CI

O GitHub Actions roda o `.github/workflows/ci.yml` em todo PR e em todo push na `main`. Num PR, um push novo cancela a execução anterior do mesmo PR. Na `main`, cada push roda até o fim, sem fila com os outros.

| Job | Em PR | Na `main` | Node |
| --- | --- | --- | --- |
| `changes` | Compara o PR com a branch de destino e diz se ele muda código | Roda sem checkout e diz que muda: a `main` sempre testa | — |
| `check` | `npm run ci:static`, no projeto inteiro | O mesmo | `.nvmrc` |
| `unit` | `npm test -- --changed HEAD^1 --passWithNoTests` | `npm test` | `22.22.3` e `.nvmrc`, em matriz |
| `integration` | `npm run test:int -- --changed HEAD^1 --passWithNoTests` | `npm run test:int` | `.nvmrc` |
| `ci` | Falha se um dos outros falhou ou foi cancelado. Um job pulado conta como aprovado. É o check obrigatório do PR | O mesmo | — |

- **PR só de Markdown:** quando todos os arquivos do PR são `*.md` ou estão em `docs/`, o `unit` e o `integration` são pulados, e o `ci` passa. O filtro fica num job, e não no gatilho do workflow, para o check obrigatório continuar aparecendo no PR.
- **Só os testes afetados:** em PR, o checkout é o merge do PR na branch de destino, e `HEAD^1` é a ponta da branch de destino. O `--changed HEAD^1` roda os testes ligados por import aos arquivos do PR, ou a suíte inteira quando o PR muda um arquivo do `forceRerunTriggers` do `vitest.config.ts`. Um PR verde pode não ter rodado um teste que o grafo de imports não liga à mudança. A `main` roda tudo e pega o que escapou. O que o `--changed` enxerga: [Testes](testes.md#só-os-testes-afetados).
- **Instalação em cache:** os jobs `check`, `unit` e `integration` usam a composite action `.github/actions/setup`. Ela instala o Node e restaura o `node_modules` do `actions/cache`, com a chave `node-modules-<SO>-<versão do Node resolvida>-<hash do package-lock.json>`, e roda `npm ci` só quando o cache não acerta. Mudar o lockfile ou a versão do Node gera um cache novo.
- **Sem fail-fast:** os jobs rodam em paralelo, a matriz do `unit` não cancela a outra versão quando uma falha, e o Vitest não para no primeiro erro. Todos os resultados saem de uma vez. Quando rever: [Evoluções com gatilho](evolucoes-com-gatilho.md#ci).
- **Fora do CI:** o e2e, que depende do `docker-compose.yml`, e o `docs:links`, que depende da rede.
- **Check obrigatório:** só o `ci`. A matriz do `unit` pulada não expande, e o check dela fica com o nome cru da expressão. `npm run github:setup` (`scripts/setup-github.mjs`) cria, ou atualiza, um ruleset na branch padrão do repositório do `origin` que exige o `ci` do GitHub Actions, inclusive em push direto, e bloqueia force push e exclusão. Ao atualizar, mantém o bypass e as regras de outros tipos acrescentados pela interface. Também deixa o squash como único merge de PR e apaga o branch do PR depois do merge. Pede o `gh` autenticado com admin no repositório. Num repositório privado, o GitHub pode exigir plano pago para rulesets.

## Migrations

Cada módulo tem as suas migrations e o seu script. Elas **não** rodam sozinhas ao subir a app (`synchronize: false` e `migrationsRun: false`): rode-as antes, no setup local e no pipeline de deploy. Passo a passo para criar uma: [Como gerar uma migration](../how-to/gerar-uma-migration.md). Para aplicar todas e conferir o que falta: [Como rodar as migrations e os seeds](../how-to/rodar-as-migrations-e-os-seeds.md).

| Comando | O que faz |
| --- | --- |
| `npm run db:setup` | Aplica as migrations pendentes de todos os módulos: roda cada script `mig:<módulo>:run` do `package.json`, um depois do outro, e para no primeiro que falhar (`scripts/run-scripts.mjs`). Um módulo novo entra sozinho |
| `npm run mig:<módulo>:run` | Aplica as migrations pendentes de um módulo. Um script por módulo com tabelas, mais o `outbox` |
| `npm run mig:<módulo>:gen` | Gera uma migration comparando as entidades com o banco, que precisa estar no ar |
| `npm run db:migrate:prod` | O `db:setup` de produção: roda cada `mig:<módulo>:run:prod`, a partir do `dist/`. É o passo de migration da imagem Docker ([Como fazer o deploy](../how-to/fazer-o-deploy.md)) |
| `npm run mig:<módulo>:run:prod` | Aplica as migrations pendentes de um módulo com o data source compilado (`typeorm migration:run -d dist/.../<módulo>.data-source.js`). Exige `npm run build` antes |

Os scripts `:run` e `:gen` usam `typeorm-ts-node-esm` com `NODE_OPTIONS=--conditions=@app/source`. Sem essa condição, os aliases `#...` carregam o `dist/`, que pode estar desatualizado, e nada avisa ([ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md)).

Os `:run:prod` fazem o contrário: rodam o JavaScript do `dist/`, sem `ts-node`, que não existe na imagem de produção, e sem `@app/source`, para os aliases caírem no `dist/`. O padrão do `db:setup` (`^mig:.+:run$`) não casa com eles.

## Seeds

Só para desenvolvimento. Dados que o sistema precisa para funcionar vão numa migration. Para criar o seed de um módulo, ver [Como criar um seed](../how-to/criar-um-seed.md).

- `npm run db:seed` roda todos: cada script `seed:<módulo>` do `package.json`, um depois do outro, e para no primeiro que falhar (`scripts/run-scripts.mjs`). Um seed novo entra sozinho.
- `npm run seed:<módulo>` roda o de um módulo só. Só tem seed o módulo com um script `seed:<módulo>` no `package.json`. O que cada seed cria está na doc do módulo, em [Módulos](../README.md#módulos).
- Rode as migrations antes.
- Só rodam com `NODE_ENV=development` ou `test`. Qualquer outro valor, ou nenhum, recusa.
- Inserem só o que falta e não sobrescrevem o que existe, então podem rodar mais de uma vez.
- Usuários de teste: `admin@example.com` e `user@example.com`, os dois com a senha `Senha@12345`.

## Geradores

| Comando | O que gera |
| --- | --- |
| `npm run plop module <nome>` | Um módulo com todas as camadas, com o nome no singular. Registra o módulo no `src/app.module.ts`, cria os scripts `mig:<nome>:gen`, `mig:<nome>:run` e `mig:<nome>:run:prod` e cria o helper dos testes de integração, `test/helpers/<nome>-database.ts`. Gera também `docs/reference/modules/<nome>.md`, que falha no `docs:check` até os comentários do template serem apagados, e a lista o módulo no índice de `docs/README.md`, onde falta escrever a descrição de uma linha. Rode `npm run mig:<nome>:run` antes de subir a app. Os passos seguintes estão em [Como criar um módulo](../how-to/criar-um-modulo.md). Templates em `plop-templates/module/` e `plop-templates/doc/module.md.hbs` |
| `npm run plop doc <tipo> "<nome>"` | Uma página de `docs/` do tipo `tutorial`, `how-to`, `reference` ou `explanation`. Templates em `plop-templates/doc/`. A página falha no `docs:check` até os comentários do template serem apagados |

## Testar a imagem de produção

O profile `prod` do `docker-compose.yml` gera a imagem, roda as migrations dela e sobe a app na porta 3000. Fica fora do `docker compose up` de sempre. Os comandos estão em [Como fazer o deploy](../how-to/fazer-o-deploy.md#testar-a-imagem-localmente).

## Baixar o ambiente

`docker compose down -v --remove-orphans`, na raiz do repositório. Remove os containers, a rede e os volumes `<pasta>_*`: o Compose usa o nome da pasta do repositório como nome do projeto. Para voltar a um ambiente limpo e no ar: [Como resetar o ambiente local](../how-to/resetar-o-ambiente-local.md).

Nunca use `docker volume prune` nem `docker system prune`, e não remova volumes, containers ou redes de outros projetos.
