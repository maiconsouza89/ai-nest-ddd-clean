# Roadmap das issues abertas

Ordem, dependências e paralelismo das 8 issues abertas em 2026-11-25 e das que entraram depois: a #56 na onda 3 e as pendentes em 2026-11-26 na onda 4, e a #68 na onda 5. O escopo e o critério de pronto de cada uma estão na própria issue: este plano não os repete, só diz em que ordem fazer e o que pode rodar junto.

A base de partida está saudável: `npm run ci` passa, não há TODO nem FIXME no código, e as dívidas conhecidas estão em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md), sem gatilho atingido fora o da #15. Os patches pendentes entraram no PR #38, e o Nest ficou em 12.6.0 pela regressão do `applyDecorators` ([Versões e exceções](../reference/versoes-e-excecoes.md)).

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa a issue.

| Assunto | Decisão |
| --- | --- |
| Refatoração antes das issues | Nenhuma. A base passa no CI e não tem dívida sem gatilho |
| Prioridade | A do rótulo da issue (`prioridade: alta`, `média`, `baixa`), com a #13 primeiro por ser a única alta e reescrever o `ci.yml` |
| Paralelismo | Cada trilha num worktree próprio, com `npm run worktree:setup` ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)). Uma issue por PR |
| #15 e #17 | Em sequência: as duas mexem no `tracing.ts` e no `observabilidade.md` |
| #21 e #23 | Depois do merge da #13, que põe as actions no lockfile (`.github/workflows/actions.lock`) |
| Dependabot da #13 | O `ignore` cobre os pacotes da tabela de exceções, inclusive `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` e `@nestjs/testing` em 12.6.0 |

## Mapa

| Onda | Trilha | Issue | Prioridade | Depende de | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | A | #13 Dependabot, CodeQL, dependency review e lockfile das actions | alta | — | 🟡 |
| 1 | B | #19 Rate limit do login também por conta | média | — | ✅ (#47) |
| 1 | C | #15 Troca do `module.register` (DEP0205) | média | — | ✅ (#46) |
| 1 | D | #16 Gatilho de `@nestjs/outbox`, `@nestjs/webhooks` e `@nestjs/http-client` | média | — | ✅ (#45) |
| 2 | C | #17 Métricas com OpenTelemetry | média | #15 | ✅ (#51) |
| 2 | E | #21 Relatório de cobertura de testes | baixa | #13 | ✅ (#52) |
| 2 | F | #22 Hooks de pre-commit e commitlint | baixa | — | ✅ (#53) |
| 2 | G | #23 Mudanças do OpenAPI que quebram clientes | baixa | #13 | ✅ (#54) |
| 3 | H | #56 Respostas de sucesso no OpenAPI | baixa | #23 | ✅ (#59) |
| 4 | I | #49 `test:int` falha em worktree pelo `MAILPIT_TAG` | média | — | ✅ (#64) |
| 4 | J | #62 Eventos da outbox morrem com o Redis fora do ar | média | — | ✅ (#66) |
| 4 | K | #48 Secret scanning e push protection | média | #13 | ⬜ |
| 4 | L | #60 How-tos de erro de domínio, serviço externo e rota protegida | baixa | — | ✅ (#65) |
| 5 | M | #68 Organização da infra do shared ([plano](organizacao-da-infra-do-shared.md)) | baixa | — | 🟡 |

A #22 não depende de nenhuma e pode subir para a onda 1 se houver capacidade.

Ordem de merge: #13 → #16 → #15 → #19 → #17 → #21, #22 e #23. Quem entra depois faz rebase.

Na onda 4, a #49, a #62 e a #60 rodam juntas. A ordem de merge é #49 → #62 → #60, e a #48 entra depois:

- A #49 vem primeiro porque, até o merge dela, o `npm run test:int` falha num worktree no teste de SMTP. As outras trilhas rodam com `MAILPIT_TAG= npm run test:int` até o rebase.
- A #48 espera a #13 fechar (passos 13 e 14 do registro dela), por decisão do dono. Ligar o secret scanning e a push protection é mudança de configuração do repositório e pede o ok do dono.
- A #62 cria uma ADR nova, e a #48 pode criar outra. A primeira a entrar fica com o número 0016.

## Arquivos em comum

O conflito esperado entre trilhas, para resolver no rebase:

| Arquivo | Issues | Conflito |
| --- | --- | --- |
| `.github/workflows/ci.yml` | #13, #21, #23 | A #13 reescreve cada `uses:`. As outras entram depois dela |
| `.github/workflows/actions.lock` | #13, #22, #23 | Quem muda um `uses:` roda `gh actions-lock` depois do rebase |
| `scripts/setup-github.mjs` | #13, #22, #23 | A #22 acrescenta o `pr-title` aos checks obrigatórios |
| `src/tracing.ts`, `docs/explanation/observabilidade.md` | #15, #17 | Em sequência, na mesma trilha |
| `docs/reference/evolucoes-com-gatilho.md` | #15, #16 | Uma linha cada |
| `docs/reference/versoes-e-excecoes.md` | #13, #16 | Seções diferentes |
| `package.json`, `package-lock.json` | #13, #15, #17, #21, #22, #23 | O lockfile se refaz com `npm install` depois do rebase |
| `docs/reference/comandos.md` | #13, #21, #22, #23 | Seções diferentes |
| `.github/CONTRIBUTING.md` | #21, #22, #23 | Seções diferentes |
| `Dockerfile` | #17, #22 | A #22 só acrescenta `--ignore-scripts` aos dois `npm ci` |
| Auth (`auth.controller.ts`, throttler, docs de autenticação) | #19 | Nenhum |
| `openapi.json`, controllers, `docs/reference/operacao.md` | #56 | Nenhum com trilha aberta. O `openapi.json` se refaz com `npm run openapi:generate` depois do rebase |
| `test/helpers/mailpit.ts`, `test/setup-env.ts`, `docs/reference/testes.md` | #49 | Nenhum |
| `src/shared/infra/outbox/`, `docs/reference/outbox-e-filas.md`, `docs/reference/operacao.md`, `docs/explanation/entrega-de-eventos.md` | #62 | Nenhum com trilha aberta |
| `scripts/setup-github.mjs`, `docs/adr/0012-cadeia-de-suprimentos-do-ci.md` | #48 | Nenhum com trilha aberta |
| `docs/adr/0016-*.md` | #48, #62 | Quem entra depois renumera a própria ADR no rebase, no arquivo e nos links |
| `docs/README.md` | #13, #48, #60, #62 | Linhas novas em seções diferentes: how-tos (#60), ADRs (#48, #62) e "Fora dos quadrantes" (#13) |
| `AGENTS.md` | #60, #62 | Linhas novas na tabela de rotas: a #60 com os três how-tos, a #62 se o reprocesso virar how-to |
| `docs/reference/comandos.md` | #48, #62 | Seção CI na #48. A #62 só mexe nela se o reprocesso virar comando |
| `src/shared/infra/`, `src/app.module.ts` e as páginas do passo 10 do [plano](organizacao-da-infra-do-shared.md#passo-10-adr-0017-e-documentação) | #48, #68 | A #48 pode criar uma ADR antes da 0017 da #68: quem entra depois renumera a própria ADR |

## Como usar

- Antes de começar uma issue, leia o corpo dela (`gh issue view <n>`) e as páginas da tabela de rotas do `AGENTS.md` para o assunto.
- Ao começar, marque 🟡 no mapa e crie o worktree da trilha. Ao fazer o merge, marque ✅ e anote o PR na linha.
- Uma issue só termina com `npm run ci` passando, `npm run test:int` e `npm run test:e2e` quando ela toca banco, Redis, filas ou HTTP, e depois de `/simplify` e `/code-review` (fluxo de entrega do `AGENTS.md`).
- Uma issue nova entra no mapa com onda, dependência e os arquivos em comum. Uma descartada sai do mapa, com o motivo num comentário dela.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída.
- Push, abertura de PR e mudança de configuração do repositório no GitHub só com o ok do dono do repositório.
- Quando todas as linhas estiverem ✅, apague este arquivo, tire a rota "Continuar um plano em andamento" do `AGENTS.md` e atualize a linha de planos do `docs/README.md`. O registro fica no histórico do git.
