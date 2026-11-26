# Plano da tag do Mailpit no `test:int` (#49)

A issue #49 relata que, num worktree montado com `npm run worktree:setup`, o `npm run test:int` falha no teste "envia o e-mail com remetente, destinatário, assunto e corpo" do `smtp-email-sender.int-spec.ts`. O `.env` do worktree define `MAILPIT_TAG=wt<N>`, e o `test/setup-env.ts` o copia para o ambiente dos testes. O `test/helpers/mailpit.ts` passa então a buscar com `tag:"wt<N>"`. O teste, porém, sobe um Mailpit próprio pelo Testcontainers e envia direto a ele, sem o usuário SMTP do worktree, e a mensagem chega sem a tag. Pronto quando o `npm run test:int` passa num worktree, como passa no checkout principal e no CI.

**Mudanças em relação ao texto da issue:**

- **A tag passa a ser do Mailpit compartilhado.** Das duas correções que a issue propõe, entra a primeira: o helper só aplica a tag quando consulta a API do Mailpit do docker-compose (`MAILPIT_API`). Uma API passada pelo teste é a de um Mailpit descartável, que não conhece os usuários SMTP dos worktrees.
- **Entra um teste do helper.** O CI não define `MAILPIT_TAG`, então nenhum job pegaria a volta do defeito. Um unitário do helper cobre os dois casos.

Tudo entra em **um PR**, na branch `fix/tag-do-mailpit-no-test-int`. O registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

## Decisões

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-26, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Onde corrigir | No `test/helpers/mailpit.ts`. A tag entra na busca só quando a API consultada é a `MAILPIT_API`. O `setup-env.ts` continua copiando o `MAILPIT_TAG` para todos os projetos do Vitest, porque os e2e precisam dele |
| Leitura do `MAILPIT_TAG` | Na chamada, e não no topo do módulo. O teste do helper troca o ambiente com `vi.stubEnv` sem recarregar o módulo |
| Por que não limpar a tag no setup do `int` | O `setupFiles` é o mesmo para os três projetos, e o `setup-env.ts` não sabe qual roda. Separar um setup só do `int` mexeria no `vitest.config.ts` e no `forceRerunTriggers` para tratar um caso que o helper resolve numa linha |
| Teste | Unitário, em `test/helpers/mailpit.spec.ts`, com o `fetch` trocado por `vi.stubGlobal`. Ele entra no projeto `unit` pelo padrão `test/**/*.spec.ts`. A conferência num worktree de verdade fica manual (passos 2 e 5) |
| Tipo do commit e do PR | `fix(test)`: corrige o apoio aos testes, sem mudar a app |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Separar o setup de cada projeto do Vitest | Nenhum. Só volta se outro valor do `.env` vazar para o `int` |
| Rodar o `test:int` com `MAILPIT_TAG` no CI | Nenhum. O unitário cobre o caso sem um job novo |

## Referências

- Issue #49: `gh issue view 49`.
- Código: `test/helpers/mailpit.ts` (o `TAG` lido no topo e o `emailsTo`), `test/setup-env.ts` (`CONNECTION_KEYS`), `src/modules/notifications/infra/adapters/smtp-email-sender.int-spec.ts` (passa a própria `api`), `scripts/worktree-env.mjs` (`MAILPIT_TAG: slotTag(slot)`) e `vitest.config.ts` (os três projetos herdam o `setupFiles`).
- Quem usa o helper sem passar a `api`: `test/auth.e2e-spec.ts`, `test/orders.e2e-spec.ts` e `test/primeiro-pedido.e2e-spec.ts`. O comportamento deles não muda.
- Páginas a mudar: `docs/reference/testes.md` (linha do `test/helpers/mailpit.ts` em "Apoio aos testes"). Confira também as menções ao `MAILPIT_TAG` em `docs/reference/variaveis-de-ambiente.md`, `docs/reference/comandos.md` e `docs/how-to/trabalhar-com-worktrees-em-paralelo.md`. Elas falam do e2e e devem continuar certas.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): nenhum. Esta trilha entra primeiro na onda 4, para as outras rodarem o `test:int` no worktree sem o `MAILPIT_TAG=` na frente.

## Como usar

- Execute os passos em ordem, um commit por passo que muda arquivo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal: data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR e comentário na issue só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Reprodução | ✅ |
| 3 | Tag só no Mailpit compartilhado, com teste | ✅ |
| 4 | Documentação | ✅ |
| 5 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha I a partir da `main`, com a branch `fix/tag-do-mailpit-no-test-int`, e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)). Este plano já está na `main`.
2. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #49 como 🟡.
3. Commit: `docs(plan): começa a correção da tag do Mailpit no test:int (#49)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: reprodução

Sem mudar código.

1. No worktree, confira que o `.env` tem `MAILPIT_TAG=wt<N>`.
2. `npm run test:int -- smtp-email-sender`: 1 falha, no teste do envio, por tempo esgotado na espera do e-mail.
3. `MAILPIT_TAG= npm run test:int -- smtp-email-sender`: os 2 testes passam.
4. Se o resultado for outro, pare e leve ao dono antes de seguir.

### Passo 3: tag só no Mailpit compartilhado

1. Em `test/helpers/mailpit.ts`:
   - tire a constante `TAG` do topo;
   - no `emailsTo`, leia a tag na chamada, só quando `api === MAILPIT_API`: `const tag = api === MAILPIT_API ? process.env.MAILPIT_TAG : undefined`;
   - troque o comentário do topo: a tag vem do usuário SMTP do worktree no Mailpit compartilhado, e um Mailpit que o teste sobe não a conhece.
2. `test/helpers/mailpit.spec.ts`, com `vi.stubGlobal('fetch', ...)` devolvendo `{ messages: [] }` e `vi.stubEnv('MAILPIT_TAG', 'wt3')`:
   - na API padrão, a consulta leva `tag:"wt3"` e o destinatário;
   - numa API passada pelo teste (`http://127.0.0.1:18025`), a consulta leva só o destinatário;
   - sem `MAILPIT_TAG`, a API padrão leva só o destinatário.

   Confira a consulta decodificando o `query` da URL recebida pelo `fetch`. No `afterEach`, `vi.unstubAllGlobals()` e `vi.unstubAllEnvs()`.
3. `npm run typecheck`, `npm run lint` e `npm test -- mailpit`.
4. `npm run test:int -- smtp-email-sender` no worktree, sem mudar o ambiente: os 2 testes passam.
5. Commit: `fix(test): aplica a tag do worktree só no Mailpit compartilhado (#49)`.

### Passo 4: documentação

1. `docs/reference/testes.md`, linha do `test/helpers/mailpit.ts`: com `MAILPIT_TAG` (num worktree), a busca no Mailpit compartilhado filtra pela tag, além do destinatário. Uma API passada pelo teste, como a do Mailpit do Testcontainers, não leva a tag.
2. Confira as outras menções ao `MAILPIT_TAG` da lista em [Referências](#referências). Mude só o que ficar errado.
3. `npm run docs:check`.
4. Commit: `docs(testes): a tag do Mailpit vale só no Mailpit compartilhado (#49)`.

### Passo 5: verificação, revisão, registro e PR

1. `npm run ci`.
2. No worktree, sem `MAILPIT_TAG=` na frente:
   - `npm run test:int`: a suíte inteira passa;
   - com o `start:dev` do worktree parado, `npm run test:e2e -- auth`: passa, e a busca continua filtrando pela tag no Mailpit compartilhado.
3. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar código, repita os itens 1 e 2.
4. Faça rebase sobre a `main` e rode `npm run ci` de novo.
5. Com o ok do dono, faça push e abra o PR com o título `fix(test): aplica a tag do Mailpit só no Mailpit compartilhado (#49)`. A descrição traz a causa, a correção escolhida e a que ficou de fora, o resultado da reprodução (passo 2) e o da verificação no worktree (item 2).
6. Com o ok do dono, deixe na issue um comentário de registro com este plano e os mesmos pontos da descrição.
7. Último commit da branch, `docs(plan): fecha o plano da tag do Mailpit no test:int (#49)`:
   - apague este plano;
   - no roadmap, marque a #49 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #49, como os das outras issues;
   - rode `npm run docs:check` de novo e faça push.
