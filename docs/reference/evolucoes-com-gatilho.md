---
type: reference
---

# Evoluções com gatilho

Mudanças adiadas de propósito, cada uma com a condição que a destrava. Os pacotes que ficam fora da latest, com o gatilho de cada um, estão em [Versões e exceções](versoes-e-excecoes.md).

## Código e dependências

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| `@nestjs/authentication` e `@nestjs/authorization` chegarem à 1.0 | Reavaliar a troca do guard próprio, do refresh token e do `RolesGuard` pelos pacotes oficiais. O `@nestjs/authorization` nega por padrão com `@Can()` | [Autenticação e ownership](../explanation/autenticacao.md), [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md) |
| O `@opentelemetry/instrumentation-nestjs-core` aceitar o Nest 12 | Atualizar a dependência. Nada desliga os spans de controller: a instrumentação do Nest já vem no `getNodeAutoInstrumentations` do `tracing.ts` e só não age porque aceita Nest abaixo do 12 (`>=4.0.0 <12` na 0.72.1). Confira que os spans de controller aparecem | [Observabilidade](../explanation/observabilidade.md) |
| O `engines` exigir Node `>=22.22.3` (linha 22) ou `>=24.11.1` | Trocar o `module.register` do `tracing.ts` (depreciado, DEP0205) pelo `register` de `import-in-the-middle/register-hooks.mjs`, que usa o `module.registerHooks`. O `import-in-the-middle` é dependência transitiva do `@opentelemetry/instrumentation`: adicione-o ao `package.json` na mesma versão, para que o hook e o `Hook()` do OpenTelemetry usem a mesma instância. Confira que os spans do `ioredis` e do `express` continuam aparecendo | [Observabilidade](../explanation/observabilidade.md) |
| Uma medição mostrar custo no `ActorResolver` | Cache curto no Redis, invalidado por evento quando os roles mudarem | [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md) |
| Permissões crescerem além de roles | CASL (`@casl/ability`, com receita na documentação do Nest) | [Autenticação e ownership](../explanation/autenticacao.md) |
| Clientes legítimos perderem a sessão por renovar em paralelo com o mesmo refresh token, ou por repetir a renovação depois de perder a resposta | Janela de tolerância curta no reuso: devolver o sucessor já emitido em vez de revogar a família | [Autenticação e ownership](../explanation/autenticacao.md) |
| Uma regra do `strictTypeChecked` deixada de fora passar a pegar bug real, ou o desenho que a impede mudar | Reavaliar a regra | [ADR 0004](../adr/0004-lint-e-formatacao.md) |
| Um acesso por índice sem checagem causar bug, ou a `no-unnecessary-condition` pedir para tirar uma guarda de índice | Ligar o `noUncheckedIndexedAccess` no `tsconfig.json`. Em 2026-11-23 eram 29 erros do `tsc`, em 9 arquivos de teste e 5 de produção | [ADR 0004](../adr/0004-lint-e-formatacao.md) |

## Infraestrutura e dados

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| Antes do primeiro deploy em produção, ou quando `shared.processed_events`, `orders.idempotency_keys` ou as linhas mortas da outbox passarem de ~1 milhão de linhas | Limpeza periódica das três: as marcas de `processed_events` mais velhas que a retenção dos jobs, as chaves com `expiresAt` vencido e as linhas com `deadAt` já inspecionadas | [Consistência e eventos](../explanation/consistencia-e-eventos.md#o-evento-sai-pela-outbox) |
| Deploy em produção | Separar o Redis em duas instâncias: a das filas com `noeviction` e AOF, e a do cache com uma política que apaga chaves, como `allkeys-lru`. O cache passa a ler uma URL de conexão própria | [Redis](../explanation/redis.md#uma-instância-para-filas-e-cache-só-em-desenvolvimento) |
| Um fornecedor real instável, com tráfego suficiente para que vários segundos de timeout por requisição esgotem o pool | Circuit breaker na chamada ao fornecedor (por exemplo, `opossum` ou `cockatiel`): passado um limite de falhas, para de chamar por um tempo e falha na hora | [Serviços externos](../explanation/servicos-externos.md#circuit-breaker-quando-houver-tráfego) |
| Uma listagem crescer sem limite, passar a ser lida por rolagem infinita, ou as páginas altas ficarem lentas | Paginação por cursor (keyset): a rota recebe `after` no lugar de `page`, e a resposta devolve o cursor da próxima página no lugar do `total` | [Como paginar uma listagem](../how-to/paginar-uma-listagem.md#lista-grande-ou-rolagem-infinita-cursor) |

## Agentes de código

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| Trocar de modelo ou atualizar o Claude Code | Refazer o teste de roteamento (perguntas numa sessão nova, sem dicas, respondidas lendo a página certa de `docs/`) e o `/doctor prompt-audit` | [ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md) |
| O dono do repositório decidir usar skills | Recriar as skills-ponteiro `criar-modulo`, `gerar-migration` e `publicar-evento-de-integracao` em `.claude/skills/`. O corpo de cada uma manda seguir o how-to e usar o "Como verificar" dele como critério de pronto. A descrição começa pelo gatilho em linguagem natural ("um módulo deve reagir a um fato de outro módulo", e não "evento de integração"). O registro do teste de roteamento está no passo 13 de `git show d1edeb4:docs/plan/documentacao.md` | As skills-ponteiro foram removidas, e a [ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md) não as cita mais: a reversão fica registrada nesta linha |
