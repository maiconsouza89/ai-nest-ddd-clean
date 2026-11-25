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
| Um cliente precisar saber quando tentar de novo depois de um 503 (`PAYMENT_UNAVAILABLE`, ou rate limit com o Redis fora do ar) | Cabeçalho `Retry-After` no 503. O `ProblemDetailsFilter` não põe nenhum hoje: o prazo teria de vir do erro ou do registro de status | [Respostas de erro](respostas-de-erro.md) |
| O pipeline de deploy precisar barrar uma versão com migration pendente | Um `db:status:prod` com `typeorm migration:show` sobre o data source do `dist/` de cada módulo, como o `db:migrate:prod` faz com o `migration:run` | [Como fazer o deploy](../how-to/fazer-o-deploy.md) |
| O passo de migration rodar com um usuário de banco próprio ou com menos secrets que a app | Os data sources validam só o `DATABASE_URL`, e não o ambiente inteiro. Hoje eles chamam o `validateEnv`, que exige todas as variáveis obrigatórias, então o passo recebe o mesmo ambiente da app | [Como fazer o deploy](../how-to/fazer-o-deploy.md) |

## CI

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| Os minutos de CI pesarem no custo ou na fila | Fail-fast entre jobs: `unit` e `integration` com `needs: check`, para um erro de lint ou de tipo não subir containers. O resultado dos testes passa a sair depois do `check`, e não junto dele | [Comandos](comandos.md#ci). Alternativas piores: `gh run cancel` quando um job falha (exige `actions: write`), `--bail` (esconde as outras falhas) e `fail-fast` na matriz (perde qual versão do Node falhou) |
| O Vitest de um job passar de 2 min na `main` | Sharding: o job vira uma matriz com `vitest run --shard=<i>/<n>`, e um job final junta os relatórios com `--merge-reports` | Cada shard paga o próprio setup (instalação, containers, templates). Com a integração em paralelo num Postgres compartilhado, a suíte inteira leva uns 15 s locais ([Testes](testes.md#convenções), [Sharding no Vitest](https://vitest.dev/guide/improving-performance#sharding)) |
| O pull das imagens Docker passar de 15 s num job | Cache das imagens (`docker save` e `actions/cache`, com a tag na chave) ou um registry mais perto do runner | O runner começa sem imagens: a primeira execução do Testcontainers baixa `postgres:19`, `redis:8` e o Mailpit ([Comandos](comandos.md#ci)) |
| O workflow passar de 2 min na `main`, ou o job `e2e` passar de 2 min | Arquivos e2e em paralelo, cada um com o seu banco e o seu Redis lógico, como a integração. Num PR sem e2e afetado, decidir se há e2e afetado antes dos `services:` e do `db:setup`, num job leve, para não pagar uns 40 s à toa | O `e2e` é o caminho crítico do workflow: 1m52s na run `45545337438` da `main`, contra a meta de 1m48s, aceita pelo dono do repositório. O job soma uns 15 s de containers, 11 s de `db:setup` e 72 s de Vitest, em série porque os arquivos gravam no mesmo banco ([Comandos](comandos.md#ci), [registro da issue #14](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/14#issuecomment-7152733280)) |
| Um e2e falhar localmente por estado do docker-compose ou por um `start:dev` esquecido | E2E com Testcontainers num `globalSetup`, como a integração: Postgres, Redis e Mailpit descartáveis por execução, com as migrations aplicadas nele | Hoje o e2e grava no banco do docker-compose, e outra instância no mesmo Redis consome as filas do BullMQ. No CI, os `services:` já dão um ambiente limpo ([Comandos](comandos.md#ci), [Testes](testes.md)) |
| Uma migration nova chegar à `main` sem entrar no `test/helpers/<módulo>-database.ts`, ou o gatilho `**/migrations/**` rodar a suíte de integração sem proveito | Uma lista única de migrations por módulo (por exemplo, `migrations/index.ts` com o array em ordem), importada pelo `*.data-source.ts` e pelo helper. Uma migration esquecida passa a quebrar também o `mig:<módulo>:run`, e o `--changed` a enxerga por import. Depois, tirar `**/migrations/**` do `forceRerunTriggers` | Os data sources carregam as migrations por glob, mas os testes de integração recebem a lista explícita do helper. Uma migration que não entra no helper roda os 16 int-specs pelo gatilho sem que nenhum a aplique ([Testes](testes.md#só-os-testes-afetados), [Como gerar uma migration](../how-to/gerar-uma-migration.md)) |

## Agentes de código

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| Trocar de modelo ou atualizar o Claude Code | Refazer o teste de roteamento (perguntas numa sessão nova, sem dicas, respondidas lendo a página certa de `docs/`) e o `/doctor prompt-audit` | [ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md) |
| O dono do repositório decidir usar skills | Recriar as skills-ponteiro `criar-modulo`, `gerar-migration` e `publicar-evento-de-integracao` em `.claude/skills/`. O corpo de cada uma manda seguir o how-to e usar o "Como verificar" dele como critério de pronto. A descrição começa pelo gatilho em linguagem natural ("um módulo deve reagir a um fato de outro módulo", e não "evento de integração"). O registro do teste de roteamento está no passo 13 de `git show d1edeb4:docs/plan/documentacao.md` | As skills-ponteiro foram removidas, e a [ADR 0006](../adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md) não as cita mais: a reversão fica registrada nesta linha |
| O primeiro deploy automatizado, ou um PR quebrar a imagem sem o CI acusar | Um job `docker` no CI: build pelo Buildx com o cache do GitHub Actions, `docker compose --profile prod up`, `/health/ready` = 200, e o job no `needs` do `ci` | Ficou de fora pelo custo de CI enquanto não há deploy automatizado. Os passos que o job repetiria estão em [Como fazer o deploy](../how-to/fazer-o-deploy.md#testar-a-imagem-localmente) |
