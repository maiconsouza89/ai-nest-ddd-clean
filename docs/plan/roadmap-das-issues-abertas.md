# Roadmap das issues abertas

Ordem, dependências e paralelismo das 8 issues abertas em 2026-11-25. O escopo e o critério de pronto de cada uma estão na própria issue: este plano não os repete, só diz em que ordem fazer e o que pode rodar junto.

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

A #22 não depende de nenhuma e pode subir para a onda 1 se houver capacidade.

Ordem de merge: #13 → #16 → #15 → #19 → #17 → #21, #22 e #23. Quem entra depois faz rebase.

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

## Como usar

- Antes de começar uma issue, leia o corpo dela (`gh issue view <n>`) e as páginas da tabela de rotas do `AGENTS.md` para o assunto.
- Ao começar, marque 🟡 no mapa e crie o worktree da trilha. Ao fazer o merge, marque ✅ e anote o PR na linha.
- Uma issue só termina com `npm run ci` passando, `npm run test:int` e `npm run test:e2e` quando ela toca banco, Redis, filas ou HTTP, e depois de `/simplify` e `/code-review` (fluxo de entrega do `AGENTS.md`).
- Uma issue nova entra no mapa com onda, dependência e os arquivos em comum. Uma descartada sai do mapa, com o motivo num comentário dela.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída.
- Push, abertura de PR e mudança de configuração do repositório no GitHub só com o ok do dono do repositório.
- Quando todas as linhas estiverem ✅, apague este arquivo, tire a rota "Continuar um plano em andamento" do `AGENTS.md` e atualize a linha de planos do `docs/README.md`. O registro fica no histórico do git.
