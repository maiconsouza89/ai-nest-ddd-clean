---
type: how-to
---

# Como rodar as migrations e os seeds

Use este guia depois de clonar o repositório, de puxar mudanças que trazem migrations novas ou de [resetar o ambiente local](resetar-o-ambiente-local.md). Para criar uma migration, siga [Como gerar uma migration](gerar-uma-migration.md). Para as migrations em produção, com o `db:migrate:prod` da imagem Docker, siga [Como fazer o deploy](fazer-o-deploy.md).

## Pré-requisitos

- `.env` criado a partir do `.env.example`, com `NODE_ENV=development`. Os seeds aceitam `development` ou `test` e recusam qualquer outro valor (`src/shared/infra/database/run-seed.ts`, [Variáveis de ambiente](../reference/variaveis-de-ambiente.md)).
- Postgres no ar:

  ```bash
  docker compose up -d --wait postgres
  ```

  O `--wait` só volta quando o container responde ao healthcheck.

## Passos

1. Aplique as migrations de todos os módulos:

   ```bash
   npm run db:setup
   ```

   Um módulo em dia responde "No migrations are pending", então o comando pode rodar de novo sem risco. Para um módulo só: `npm run mig:<módulo>:run`.

2. Rode os seeds de todos os módulos:

   ```bash
   npm run db:seed
   ```

   Os seeds inserem só o que falta e não sobrescrevem o que existe, então o comando também pode rodar de novo. Para um módulo só: `npm run seed:<módulo>`. Os usuários de teste estão em [Comandos](../reference/comandos.md#seeds).

## Como verificar

- Cada migration de um módulo aparece com `[X]`:

  ```bash
  NODE_OPTIONS=--conditions=@app/source npx typeorm-ts-node-esm migration:show -d <DataSource do módulo>
  ```

  O caminho do DataSource está no script `mig:<módulo>:run` do `package.json`. Uma migration com `[ ]` ainda não foi aplicada.

- Com `npm run start:dev`, o `http://localhost:3000/health/ready` responde 200, e o login de `admin@example.com` em `POST /v1/auth/login` devolve um `accessToken`.

Se algo falhar:

| Sintoma | Causa e saída |
| --- | --- |
| `Seeds de desenvolvimento só rodam com NODE_ENV=development ou test.` | O `NODE_ENV` do shell vence o do `.env`. Confira `echo $NODE_ENV` e o `.env` |
| Uma migration falhou no meio e o `run` seguinte falha de novo | No banco local, [resete o ambiente](resetar-o-ambiente-local.md). Numa migration sua ainda sem commit, veja o revert em [Como gerar uma migration](gerar-uma-migration.md#como-verificar) |

## Veja também

- [Comandos](../reference/comandos.md#migrations): o `db:setup`, os scripts `mig:<módulo>:*` e a condição `@app/source`.
- [Comandos](../reference/comandos.md#seeds): o `db:seed` e os scripts `seed:<módulo>`.
- [Como criar um seed](criar-um-seed.md): o seed de um módulo novo.
- [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md#cada-módulo-tem-schema-e-migrations-próprios): por que cada módulo tem migrations próprias.
