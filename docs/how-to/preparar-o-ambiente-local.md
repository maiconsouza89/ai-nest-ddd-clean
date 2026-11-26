---
type: how-to
---

# Como preparar o ambiente local

Use este guia para ter a app no ar no checkout principal, depois de clonar o repositório. Num `git worktree`, siga [Como trabalhar com worktrees em paralelo](trabalhar-com-worktrees-em-paralelo.md).

## Pré-requisitos

- Node e Docker nas versões de [Comandos → Requisitos](../reference/comandos.md#requisitos).
- Terminal na raiz do repositório.

## Passos

1. Instale as dependências:

   ```bash
   npm install
   ```

   O `npm install` instala também os [hooks do git](../reference/comandos.md#hooks-do-git). O npm pode avisar que pacotes como `argon2` e `ssh2` têm scripts de instalação não aprovados. O setup funciona sem aprová-los: o `argon2` usa um binário pronto (conferido em 2026-11-23, com o npm 11.20 e o Node 26).

2. Crie o `.env` a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

   Cada variável está em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md).

3. Suba o Postgres, o Redis e o Mailpit:

   ```bash
   docker compose up -d --wait postgres redis mailpit
   ```

   O `--wait` só volta quando os três respondem ao healthcheck. As versões e as portas estão em [Comandos → Serviços do docker-compose](../reference/comandos.md#serviços-do-docker-compose).

4. Aplique as migrations de todos os módulos e rode os seeds:

   ```bash
   npm run db:setup
   npm run db:seed
   ```

   Os detalhes e os erros comuns estão em [Como rodar as migrations e os seeds](rodar-as-migrations-e-os-seeds.md).

5. Suba a app:

   ```bash
   npm run start:dev
   ```

## Como verificar

- `http://localhost:3000/health/ready` responde 200, com `database` e `redis` em `up`.
- `http://localhost:3000/docs` abre o Swagger.
- O login de `admin@example.com`, com a senha `Senha@12345`, em `POST /v1/auth/login` devolve um `accessToken`.

## Veja também

- [Comandos](../reference/comandos.md#endereços): os endereços com a app no ar.
- [Como resetar o ambiente local](resetar-o-ambiente-local.md): voltar o Postgres e o Redis ao estado de um clone novo.
- [Do clone ao primeiro pedido](../tutorials/01-do-clone-ao-primeiro-pedido.md): o mesmo setup como aula guiada, até um pedido pago.
