@AGENTS.md

# CLAUDE.md

<!-- Só o que é exclusivo do Claude Code. O que vale para qualquer agente fica no AGENTS.md (ADR 0006). -->

## Context7

Consulte a documentação atual no Context7 (MCP `context7`: `resolve-library-id`, depois `query-docs`) antes de adicionar ou atualizar uma biblioteca, framework ou SDK, e antes de usar uma API dela que o repositório ainda não usa. O conhecimento de treino pode estar velho; o código que já está no repositório mostra a API da versão instalada.

- Ao adicionar ou atualizar, confira a versão estável mais recente e a API atual.
- Ao migrar de versão ou corrigir um erro específico de biblioteca, leia o guia de migração antes de mudar o código.
- Sem a biblioteca no Context7, use a documentação oficial na web e diga isso.

## Fluxo de entrega

Numa entrega de implementação (código novo ou alterado), antes de reportar como pronta:

1. Rode a skill `/simplify` sobre as mudanças.
2. Depois rode a skill `/code-review` sobre as mudanças.

Se uma etapa não se aplicar, diga na mensagem final qual foi pulada e por quê.
