---
type: how-to
---

# Como trabalhar com worktrees em paralelo

Use este guia para rodar a app e os testes em mais de um `git worktree` ao mesmo tempo, cada um com a sua porta, o seu banco, o seu banco lógico do Redis e a sua tag no Mailpit, todos sobre o Postgres, o Redis e o Mailpit do checkout principal. O porquê do desenho está no [ADR 0011](../adr/0011-worktrees-compartilham-o-stack-do-checkout-principal.md).

## Pré-requisitos

- O checkout principal com `.env` (`cp .env.example .env`, no [setup](../reference/comandos.md#setup-do-zero)). O `.env` de cada worktree é gerado a partir dele.
- O Docker no ar. O stack do principal não precisa estar de pé: o setup o sobe.
- Até 15 worktrees com ambiente ao mesmo tempo, o número de bancos lógicos do Redis fora o 0 do principal.

## Passos

1. Crie o worktree por qualquer caminho: o herdr, o `claude --worktree <nome>` ou `git worktree add <caminho> <branch>`.
2. Na raiz do worktree, monte o ambiente dele:

   ```bash
   npm run worktree:setup
   ```

   O setup reserva o menor slot `N` livre, gera o `.env` com a porta `3000 + N`, o banco `app_wt<N>`, o banco lógico `N` do Redis e o usuário SMTP `wt<N>`, copia o `.env.local` do principal sem essas chaves (sem um no principal, filtra o do worktree), roda o `npm ci` se falta `node_modules`, sobe o stack do principal e roda o `db:setup` e o `db:seed`. Ao fim, imprime o slot e os endereços. Num slot que um worktree removido usou, ele apaga antes o que sobrou. Um `.env` copiado de outro worktree, com o slot dele, ganha um slot próprio. Rodar de novo mantém o slot e os dados, e regera o `.env` e o `.env.local`; `--install` força o `npm ci` (`npm run worktree:setup -- --install`).

3. Suba a app: `npm run start:dev`. Ela escuta na porta `3000 + N`.
4. Rode o e2e: `npm run test:e2e`. Ele grava no banco do worktree e lê do Mailpit só os e-mails da tag dele. Encerre antes o `start:dev` deste mesmo worktree: os dois consumiriam as mesmas filas. O `start:dev` de outro worktree ou do principal não interfere.

Num worktree sem o setup, o `start:dev`, o `test:e2e`, o `db:setup` e o `db:seed` param com "rode `npm run worktree:setup`", antes de abrir conexão com o banco do principal.

## Como verificar

- `http://localhost:<3000 + N>/health/ready` responde 200.
- O banco do worktree tem as tabelas e os usuários do seed: `docker compose exec postgres psql -U postgres -d app_wt<N> -c 'select email from identity.users'`.
- Os e-mails do worktree aparecem no Mailpit pela busca `tag:wt<N>`: `http://localhost:8025/#search?q=tag:wt<N>`.

## Limpar e remover

1. Apague os dados do slot: `npm run worktree:down`. Ele apaga o banco `app_wt<N>`, esvazia o banco lógico `N` do Redis e as mensagens da tag `wt<N>`. Não toca em containers nem volumes, e o `.env` fica como está: o slot continua reservado.
2. Remova o worktree: `git worktree remove <caminho>`. O slot fica livre.

Um worktree removido sem o `down` deixa o banco e as chaves para trás, mas libera o slot do mesmo jeito. O próximo worktree que reservar esse slot apaga as sobras no setup.

**Nunca rode `docker compose down -v` num worktree.** O `.env` dele aponta o Compose para o projeto do principal (`COMPOSE_PROJECT_NAME`), e o comando apaga os volumes de todos: o banco `app`, os bancos dos outros worktrees e o Redis inteiro. O `docker compose stop` também para o stack de todos. Para os dados de um worktree, use o `worktree:down`; o reset completo é só no principal ([Como resetar o ambiente local](resetar-o-ambiente-local.md)).

O profile `prod` do compose também é só do principal ([Como fazer o deploy](fazer-o-deploy.md#testar-a-imagem-localmente)): o teste da imagem para o stack de desenvolvimento, que num worktree é o de todos.

## Veja também

- [Comandos](../reference/comandos.md#worktrees): o `worktree:setup`, o `worktree:down` e a trava nos comandos.
- [Variáveis de ambiente](../reference/variaveis-de-ambiente.md#worktree): as chaves que o setup escreve no `.env`.
- [ADR 0011](../adr/0011-worktrees-compartilham-o-stack-do-checkout-principal.md): por que um stack compartilhado, e não um por worktree.
