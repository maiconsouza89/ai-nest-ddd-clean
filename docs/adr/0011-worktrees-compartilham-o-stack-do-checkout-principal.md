---
status: accepted
---

# Worktrees compartilham o stack do checkout principal, isolados por slot

O ambiente de desenvolvimento comportava um checkout por vez ([issue #35](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/35)). Dois `git worktree` em paralelo batiam nas portas fixas do `docker-compose.yml`, e, apontando para o mesmo Postgres e o mesmo Redis, as migrations de uma branch quebravam a outra, e uma instância consumia as filas do BullMQ, os jobs agendados e o rate limit da outra. Isso aconteceu durante a pesquisa da decisão: um `start:dev` no checkout principal rodou ao mesmo tempo que um `test:e2e` num worktree, os dois no mesmo Redis e no mesmo Postgres. Os worktrees nascem pelo herdr, pelo `claude --worktree` e à mão, e a solução precisava servir aos três.

Os worktrees usam o Postgres, o Redis e o Mailpit do projeto do Compose do checkout principal, nas portas de sempre, sem container novo. Cada worktree ganha um **slot** `N` de 1 a 15, gravado como `WORKTREE_SLOT` no `.env` dele. O principal é o slot 0 e não tem a variável. O slot define:

| Recurso | No worktree |
| --- | --- |
| API | Porta `3000 + N` |
| Postgres | Banco `app_wt<N>`, vazio, migrado e semeado pela própria branch |
| Redis | Banco lógico `N`, pela URL (`redis://localhost:6379/<N>`) |
| Mailpit | Tag `wt<N>`, pelo usuário SMTP (`smtp://wt<N>:x@…`), com o Mailpit marcando cada e-mail com o usuário |
| Traces | `deployment.environment.name=wt<N>` no `OTEL_RESOURCE_ATTRIBUTES` |

- `npm run worktree:setup` (`scripts/worktree.mjs`) reserva o menor slot que nenhum worktree do `git worktree list` tenha no `.env` e cuja porta esteja livre, gera o `.env` a partir do `.env` do principal, com o `COMPOSE_PROJECT_NAME` do principal, e monta o banco. Na primeira reserva, apaga o que um worktree removido deixou no slot. `npm run worktree:down` apaga só os dados do slot.
- Uma trava (`scripts/worktree-guard.mjs`) no `start:dev`, no `test:e2e`, no `db:setup` e no `db:seed` para um worktree sem `WORKTREE_SLOT`. No principal e no CI, onde o `.git` é um diretório, não faz nada.
- O e2e lê do `.env.local` e do `.env` só as chaves de conexão e a tag do Mailpit (`test/setup-env.ts`), e a busca do Mailpit filtra pela tag.

Como usar: [Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md).

## Considered Options

- **Um stack por worktree (Postgres, Redis e Mailpit próprios):** isolamento total, inclusive de versão. Cada worktree somaria uns 100 MiB de containers ociosos, portas próprias para cada serviço e o tempo de subir e migrar do zero. Ficou de fora por escolha do dono do repositório.
- **Prefixo de chave na app:** o BullMQ, o throttler, o cache e o health precisariam de um prefixo cada, em quatro pontos do `src/shared`, por um problema que só existe em desenvolvimento. O `keyPrefix` do ioredis não serve: o BullMQ o recusa. O banco lógico na URL não muda uma linha da app.
- **Hook `WorktreeCreate` do Claude Code:** só cobre os worktrees do Claude Code, substitui a criação pelo git, e reservaria um slot por subagente com `isolation: worktree`, sem um `WorktreeRemove` que o devolva.
- **`.worktreeinclude`:** copiaria o `.env` do principal para o worktree, com o banco `app` e o Redis 0, o oposto do isolamento.
- **Hook `post-checkout` do git:** dispara também no `git clone` e em todo checkout, e o git não tem hook de remoção de worktree.
- **Porta efêmera do Docker:** a porta muda a cada `start` do container (conferido no Docker 28.5), e a `DATABASE_URL` teria de ser regerada a cada vez.
- **Slot pelo hash do nome do worktree:** com 15 valores, dois nomes colidem cedo, e a colisão só aparece quando os dois rodam juntos.
- **Clonar o banco `app` (`CREATE DATABASE … TEMPLATE`):** falha com qualquer conexão aberta no `app`, e traria o schema de outra branch.
- **Pool menor só nos worktrees:** o pool ficaria diferente do principal e do CI. O `max_connections` do Postgres do compose subiu para 200.

## Consequences

- Até 15 worktrees com ambiente ao mesmo tempo, o limite dos 16 bancos lógicos do Redis.
- O `docker compose down -v` num worktree apaga os dados de todos, porque o `.env` dele aponta para o projeto do principal. O reset completo fica só no principal, e o worktree usa o `worktree:down`.
- Uma branch que muda o `docker-compose.yml` recria o stack de todos ao rodar o `docker compose up` nela. O `worktree:setup` usa o arquivo do principal e não dispara isso.
- Todos os worktrees ficam presos à mesma versão do Postgres e do Redis. Testar a troca de versão de um deles pede o checkout principal.
- O Redis Cluster só tem o banco 0. Não afeta o desenvolvimento local, que usa uma instância só; a app em produção continua sem banco lógico na URL.
- O e2e continua serial dentro de um checkout. Um `start:dev` e um e2e no mesmo worktree ainda disputam as filas; em worktrees diferentes, não.
- O profile `prod` do compose roda só no checkout principal.
