---
status: accepted
---

# `AGENTS.md` como único arquivo de instruções

O `AGENTS.md` passa a ser o único arquivo de instruções dos agentes, inclusive do Claude Code. O `CLAUDE.md` sai do repositório, e o que era exclusivo dele (a pesquisa com o Context7 e o fluxo de entrega `/simplify` → `/code-review`) vai para o `AGENTS.md`. Isso substitui o item 2 de "Fonte da verdade" da [ADR 0006](0006-documentacao-diataxis-e-roteamento-para-agentes.md). O resto dela continua valendo.

O Claude Code carrega o `AGENTS.md` como instruções do projeto quando o projeto não tem `CLAUDE.md` (conferido na versão 2.1.331). A premissa da ADR 0006 de que ele lê só o `CLAUDE.md` deixou de valer, e com ela o motivo para manter dois arquivos.

O fluxo de entrega fica marcado como do Claude Code, porque as skills `/simplify` e `/code-review` são dele. Os outros agentes seguem a definição de pronto.

## Considered Options

- **Manter o `CLAUDE.md` com `@AGENTS.md`:** dois arquivos para um conteúdo de poucas linhas, e um lugar a mais para as regras divergirem.
- **`CLAUDE.md` como symlink para o `AGENTS.md`:** desnecessário quando o Claude Code já lê o `AGENTS.md`, e symlinks se comportam mal no Windows e em algumas ferramentas.

## Consequences

- Um `CLAUDE.md` criado na raiz faz o Claude Code deixar de carregar o `AGENTS.md`. Quem precisar de um arquivo só do Claude o começa com `@AGENTS.md`, e o `docs:check` continua aceitando esse import.
- A meta de contexto fixo passa a ser o próprio `AGENTS.md`, com até 100 linhas.
