---
type: reference
---

# Comandos

Todos os comandos rodam na raiz do repositório.

## Requisitos

- Node 22.13 ou superior (`engines` do `package.json`). O `.nvmrc` recomenda o 24.
- Docker, para o Postgres e o Redis do `docker-compose.yml` e para os testes de integração.

## Setup do zero

Nesta ordem:

1. `npm install`. O npm pode avisar que pacotes como `argon2` e `ssh2` têm scripts de instalação não aprovados. O setup funciona sem aprová-los: o `argon2` usa um binário pronto (conferido em 2026-11-23, com o npm 11.20 e o Node 26).
2. `cp .env.example .env`. Cada variável está em [Variáveis de ambiente](variaveis-de-ambiente.md).
3. `docker compose up -d postgres redis`. Sobe o Postgres 19 em `127.0.0.1:5432` e o Redis 8 em `127.0.0.1:6379`.
4. As [migrations](#migrations) de todos os módulos, depois os [seeds](#seeds):

   ```sh
   for m in identity catalog inventory orders outbox; do npm run "mig:${m}:run"; done
   for m in identity catalog inventory; do npm run "seed:${m}"; done
   ```

5. `npm run start:dev`.

Com a app no ar:

| Endereço | O que é |
| --- | --- |
| `http://localhost:3000/v1/...` | API, versionada na URL |
| `http://localhost:3000/docs` | Swagger. Só existe fora de `NODE_ENV=production` |
| `http://localhost:3000/health/live` | O processo está vivo. Não consulta dependências |
| `http://localhost:3000/health/ready` | O banco e o Redis respondem |

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
| `npm run docs:check` | Lint do Markdown, links e âncoras locais, `type:` das páginas de `docs/`, comentários de template que sobraram e caminhos de `docs/` citados nos arquivos de agente |
| `npm run docs:links` | Links externos, com o lychee via Docker. Fora do CI, porque depende da rede |
| `npm run ci` | `typecheck`, `lint`, `format:check`, `docs:check`, `test` e `arch`, nessa ordem. **Não** roda integração nem e2e |

## Testes

| Comando | O que roda |
| --- | --- |
| `npm test` | Unitários (`*.spec.ts`), sem banco |
| `npm run test:watch` | Os unitários em modo watch |
| `npm run test:int` | Integração (`*.int-spec.ts`). Sobe Postgres e Redis descartáveis com o Testcontainers, então exige Docker. Leva cerca de 75 s |
| `npm run test:e2e` | E2E (`test/*.e2e-spec.ts`). Sobe o app inteiro contra o banco de `DATABASE_URL` e o Redis de `REDIS_URL` |

O runner, o `test/setup-env.ts`, a decorator metadata e qual tipo de teste cobre cada camada estão em [Testes](testes.md).

Para rodar um arquivo só, passe um padrão de caminho depois do `--`:

- `npm test -- money.vo`
- `npm run test:int -- pay-order`
- `npm run test:e2e -- auth`

Cuidados com o e2e:

- Por padrão, `DATABASE_URL` e `REDIS_URL` apontam para o Postgres e o Redis do `docker-compose.yml`. Os dois precisam estar no ar.
- O e2e **grava dados** nesse banco.
- Encerre qualquer `start:dev` antes. Outra instância no mesmo Redis consome as filas do BullMQ e derruba os testes.

## Migrations

Cada módulo tem as suas migrations e o seu script. Elas **não** rodam sozinhas ao subir a app (`synchronize: false` e `migrationsRun: false`): rode-as antes, no setup local e no pipeline de deploy. Passo a passo para criar uma: [Como gerar uma migration](../how-to/gerar-uma-migration.md).

| Comando | O que faz |
| --- | --- |
| `npm run mig:<módulo>:run` | Aplica as migrations pendentes. Um script por módulo com tabelas, mais o `outbox`, na ordem do loop do [Setup do zero](#setup-do-zero) |
| `npm run mig:<módulo>:gen` | Gera uma migration comparando as entidades com o banco, que precisa estar no ar |

Os scripts usam `typeorm-ts-node-esm` com `NODE_OPTIONS=--conditions=@app/source`. Sem essa condição, os aliases `#...` carregam o `dist/`, que pode estar desatualizado, e nada avisa ([ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md)).

Num loop do zsh, escreva `"mig:${m}:run"`, com chaves e aspas. Sem elas, `mig:$m:run` vira `mig:$m` seguido do modificador `:r`, e o npm diz que o script não existe.

## Seeds

Só para desenvolvimento. Dados que o sistema precisa para funcionar vão numa migration. Para criar o seed de um módulo, ver [Como criar um seed](../how-to/criar-um-seed.md).

- `npm run seed:<módulo>`, para `identity`, `catalog` e `inventory`. Rode as migrations antes.
- Só rodam com `NODE_ENV=development` ou `test`. Qualquer outro valor, ou nenhum, recusa.
- Inserem só o que falta e não sobrescrevem o que existe, então podem rodar mais de uma vez.
- Usuários de teste: `admin@example.com` e `user@example.com`, os dois com a senha `Senha@12345`.

## Geradores

| Comando | O que gera |
| --- | --- |
| `npm run plop module <nome>` | Um módulo no padrão do `orders`, com o nome no singular. Registra o módulo no `src/app.module.ts`, cria os scripts `mig:<nome>:gen` e `mig:<nome>:run`, acrescenta o módulo ao loop de migrations do setup do zero (aqui e no `README.md`) e cria o helper dos testes de integração, `test/helpers/<nome>-database.ts`. Gera também `docs/reference/modules/<nome>.md`, que falha no `docs:check` até os comentários do template serem apagados, e a lista o módulo no índice de `docs/README.md`, onde falta escrever a descrição de uma linha. Rode `npm run mig:<nome>:run` antes de subir a app. Os passos seguintes estão em [Como criar um módulo](../how-to/criar-um-modulo.md). Templates em `plop-templates/module/` e `plop-templates/doc/module.md.hbs` |
| `npm run plop doc <tipo> "<nome>"` | Uma página de `docs/` do tipo `tutorial`, `how-to`, `reference` ou `explanation`. Templates em `plop-templates/doc/`. A página falha no `docs:check` até os comentários do template serem apagados |

## Baixar o ambiente

`docker compose down -v --remove-orphans`, na raiz do repositório. Remove os containers, a rede e os volumes `ddd-clean-nest_*`.

Nunca use `docker volume prune` nem `docker system prune`, e não remova volumes, containers ou redes de outros projetos.
