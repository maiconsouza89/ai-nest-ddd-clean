---
type: how-to
---

# Como testar a imagem de produção localmente

Use este guia para gerar a imagem Docker e rodá-la na sua máquina na ordem do deploy, com o profile `prod` do `docker-compose.yml`: o serviço `migrate` roda o `db:migrate:prod` e termina, e o `app` só sobe depois.

## Pré-requisitos

- Terminal na raiz do checkout principal, nunca de um worktree: num worktree, o `docker compose` mira o stack do principal, que é o de todos os worktrees ([ADR 0011](../adr/0011-worktrees-compartilham-o-stack-do-checkout-principal.md)).
- Todos os comandos com `-p ai-nest-deploy-check`: o projeto isolado tem volumes próprios, e o banco de desenvolvimento não muda.
- Nenhum `start:dev` nem e2e rodando, no principal ou nos worktrees: o `app` usa a porta 3000 e consumiria as filas do BullMQ.

## Passos

1. Pare o ambiente de desenvolvimento, sem apagar os volumes:

   ```bash
   docker compose stop
   ```

2. Gere a imagem e suba tudo:

   ```bash
   docker compose -p ai-nest-deploy-check --profile prod up -d --build
   ```

3. Confira as migrations:

   ```bash
   docker compose -p ai-nest-deploy-check logs migrate
   docker compose -p ai-nest-deploy-check ps -a
   ```

   O log mostra cada migration aplicada, e o `migrate` aparece com `Exited (0)`.

4. Espere a app ficar pronta:

   ```bash
   curl --retry 20 --retry-all-errors --retry-delay 1 -fsS http://localhost:3000/health/ready
   ```

   O `--retry-all-errors` cobre o "Connection reset by peer" enquanto a app sobe: o Docker aceita a conexão na porta antes de a app escutar.

5. Faça as conferências de [Como verificar](#como-verificar).

6. Baixe o projeto isolado e devolva o ambiente de desenvolvimento:

   ```bash
   docker compose -p ai-nest-deploy-check --profile prod down -v --remove-orphans
   docker compose start
   ```

## Como verificar

Antes do passo 6:

- O passo de migration, rodado de novo, termina com código 0 e responde "No migrations are pending" em cada módulo:

  ```bash
  docker compose -p ai-nest-deploy-check --profile prod run --rm migrate
  ```

- `GET /health/ready` responde 200, com `database`, `redis-cache` e `redis-queue` em `up`.
- O desligamento sai por `SIGTERM`. Com `SHUTDOWN_GRACE_MS` no padrão, `0`, o `stop` termina em menos de 1 s, e o código de saída é `143`, e não `137` (`SIGKILL`):

  ```bash
  docker compose -p ai-nest-deploy-check stop app
  docker inspect -f '{{.State.ExitCode}}' ai-nest-deploy-check-app-1
  ```

## Veja também

- [Como fazer o deploy](fazer-o-deploy.md): a mesma imagem numa plataforma.
- [Como usar um Postgres gerenciado](usar-um-postgres-gerenciado.md): a imagem contra um banco externo.
- [Operação → Desligamento](../reference/operacao.md#desligamento): a ordem do desligamento e o `tini` como PID 1.
- [Comandos → Migrations](../reference/comandos.md#migrations): o `db:migrate:prod` e os scripts `mig:<módulo>:run:prod`.
