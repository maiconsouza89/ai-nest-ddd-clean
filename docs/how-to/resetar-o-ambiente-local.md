---
type: how-to
---

# Como resetar o ambiente local

Use este guia para voltar o Postgres e o Redis locais ao estado de um clone novo: banco sujo do e2e, migration que falhou no meio, filas do BullMQ com jobs antigos.

## Pré-requisitos

- Aceite perder **todos os dados locais** deste projeto, inclusive os bancos e as chaves de todos os worktrees.
- Nenhum `start:dev` nem e2e rodando, no principal ou em algum worktree.
- Terminal na raiz do checkout principal. Num worktree, não use este guia: `npm run worktree:down` e depois `npm run worktree:setup` voltam só o slot dele ao estado inicial ([Como trabalhar com worktrees em paralelo](trabalhar-com-worktrees-em-paralelo.md#limpar-e-remover)).

## Passos

1. Remova os containers, a rede e os volumes deste projeto:

   ```bash
   docker compose down -v --remove-orphans
   ```

   Este é o comando de limpeza: ele só alcança o que pertence a este projeto. O `docker volume prune` e o `docker system prune` apagam também volumes de outros projetos.

2. Suba o Postgres, o Redis e o Mailpit vazios:

   ```bash
   docker compose up -d --wait postgres redis mailpit
   ```

   O `--wait` só volta quando os três respondem ao healthcheck.

3. Aplique as migrations e rode os seeds: [Como rodar as migrations e os seeds](rodar-as-migrations-e-os-seeds.md#passos).

4. Suba a app: `npm run start:dev`.

## Como verificar

- `http://localhost:3000/health/ready` responde 200, com `database`, `redis-cache` e `redis-queue` como `up`.
- O login de `admin@example.com` em `POST /v1/auth/login` devolve um `accessToken`.

## Veja também

- [Comandos](../reference/comandos.md#baixar-o-ambiente): o comando para baixar o ambiente.
- [Operação](../reference/operacao.md): o que o `/health/ready` confere.
