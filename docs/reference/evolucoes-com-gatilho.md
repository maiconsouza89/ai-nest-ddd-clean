---
type: reference
---

# Evoluções com gatilho

Mudanças adiadas de propósito, cada uma com a condição que a destrava. Os pacotes que ficam fora da latest, com o gatilho de cada um, estão em [Versões e exceções](versoes-e-excecoes.md).

## Código e dependências

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| `@nestjs/authentication` e `@nestjs/authorization` chegarem à 1.0 | Reavaliar a troca do guard próprio, do refresh token e do `RolesGuard` pelos pacotes oficiais. O `@nestjs/authorization` nega por padrão com `@Can()` | [Autenticação e ownership](../explanation/autenticacao.md), [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md) |
| O `instrumentation-nestjs-core` suportar o Nest 12 | Reativar os spans de controller | [Observabilidade](../explanation/observabilidade.md) |
| O `engines` exigir Node `>=22.22.3` (linha 22) ou `>=24.11.1` | Trocar o `module.register` do `tracing.ts` (depreciado, DEP0205) pelo `register` de `import-in-the-middle/register-hooks.mjs`, que usa o `module.registerHooks`. O `import-in-the-middle` é dependência transitiva do `@opentelemetry/instrumentation`: adicione-o ao `package.json` na mesma versão, para que o hook e o `Hook()` do OpenTelemetry usem a mesma instância. Confira que os spans do `ioredis` e do `express` continuam aparecendo | [Observabilidade](../explanation/observabilidade.md) |
| Uma medição mostrar custo no `ActorResolver` | Cache curto no Redis, invalidado por evento quando os roles mudarem | [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md) |
| Permissões crescerem além de roles | CASL (`@casl/ability`, com receita na documentação do Nest) | [Autenticação e ownership](../explanation/autenticacao.md) |
| Clientes legítimos perderem a sessão por renovar em paralelo com o mesmo refresh token, ou por repetir a renovação depois de perder a resposta | Janela de tolerância curta no reuso: devolver o sucessor já emitido em vez de revogar a família | [Autenticação e ownership](../explanation/autenticacao.md) |
| Uma regra do `strictTypeChecked` deixada de fora passar a pegar bug real, ou o desenho que a impede mudar | Reavaliar a regra | [ADR 0004](../adr/0004-lint-e-formatacao.md) |
| Um acesso por índice sem checagem causar bug, ou a `no-unnecessary-condition` pedir para tirar uma guarda de índice | Ligar o `noUncheckedIndexedAccess` no `tsconfig.json`. Em 2026-11-23 eram 29 erros do `tsc`, em 9 arquivos de teste e 5 de produção | [ADR 0004](../adr/0004-lint-e-formatacao.md) |

## Agentes de código

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| Trocar de modelo ou atualizar o Claude Code | Refazer o teste de roteamento (perguntas numa sessão nova, sem dicas, respondidas lendo a página certa de `docs/`) e o `/doctor prompt-audit` | [ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md) |
| O dono do repositório decidir usar skills | Recriar as skills-ponteiro `criar-modulo`, `gerar-migration` e `publicar-evento-de-integracao` em `.claude/skills/`. O corpo de cada uma manda seguir o how-to e usar o "Como verificar" dele como critério de pronto. A descrição começa pelo gatilho em linguagem natural ("um módulo deve reagir a um fato de outro módulo", e não "evento de integração"). O registro do teste de roteamento está no passo 13 de `git show d1edeb4:docs/plan/documentacao.md` | [ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md) |
