---
type: reference
---

# Versões e exceções

## Regra

- Use sempre a **latest estável** de cada pacote.
- Quando a latest de um pacote quebra outro, use a maior versão compatível e registre a exceção na tabela abaixo, com o motivo e o gatilho para atualizar.
- Não atualize um pacote da tabela sem conferir o gatilho registrado.
- Prefira as bibliotecas oficiais e as recomendadas pela documentação do framework (por exemplo, os pacotes `@nestjs/*`) a alternativas de terceiros, salvo justificativa explícita.
- Ao propor uma dependência, informe a versão consultada e por que ela é a recomendada.
- Pacotes pré-1.0 sem histórico ficam de fora. Por exemplo, `@nestjs/authentication` 0.1.7 e `@nestjs/authorization` 0.1.4, lançados em 2026-09. O gatilho para reavaliá-los está em [Evoluções com gatilho](evolucoes-com-gatilho.md).

`npm outdated` deve listar só os pacotes da tabela, mais o `prettier` quando sai uma versão nova dele ([Versão exata](#versão-exata)).

## Versão exata

O `prettier` fica na latest, com a versão exata no `package.json` (sem `^`). O Prettier muda a formatação em versões patch, e com o `^` um `npm install` poderia fazer o `format:check` falhar sem mudança no código. A documentação do Prettier recomenda o mesmo (consultada no Context7 em 2026-11-23). Para atualizar: `npm install --save-dev --save-exact prettier@latest`, depois `npm run format`, num commit só da formatação.

## Exceções

Consultadas em 2026-11-21, e a linha do Nest em 2026-11-25.

| Pacote | Fica em | Latest | Motivo | Atualize quando |
| --- | --- | --- | --- | --- |
| `typescript` | `~6.0` | 7.0.2 | O TS 7 não expõe a API do compilador. O `@nestjs/cli` 12.0.15 depende de `typescript ~6.0.2` e o `typescript-eslint` 8.74 aceita só `>=4.8.4 <6.1.0`. O `dependency-cruiser` 18.9 já aceita o TS `>=7.1` (o 7.0 não). Conferido em 2026-11-23. | O `@nestjs/cli` e o `typescript-eslint` aceitarem o TS 7.1 ou superior. Para o TS 6.1, basta o `typescript-eslint` aceitar |
| `keyv`, `@keyv/redis` | `^5.6`, `^5.1` | 6.1.0 | O `cache-manager` 7.2.9 depende de `keyv ^5.6`. Misturar as linhas 5 e 6 deixa duas Keyv no projeto. | O `cache-manager` depender da `keyv` 6 |
| `ioredis` | `^5.11` | 6.1.0 | O `typeorm` 1.1.3 (latest, `dev` e `beta` também) declara `ioredis ^5.0.4` como peer opcional, e o `npm install` falha com ERESOLVE. O TypeORM só usa o ioredis no cache de queries, que o projeto não usa, mas o override esconderia a incompatibilidade. O ioredis 6 também passa a usar RESP3 por padrão. | O `typeorm` aceitar o ioredis 6 (issue typeorm/typeorm#12823, PR #12830). Revise então `BullMqConnection`, `RedisThrottlerStorage` e o `keys` do e2e de throttle: `protocol: 2` mantém o formato do 5 |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing` | `12.6.0` (exata) | 12.6.1 | Na 12.6.1, o tipo do `applyDecorators` virou uma assinatura só, que retorna `TFunction \| TypedPropertyDescriptor \| undefined`. O `tsc` dá TS1270 onde o `ApiProblemResponse` decora um método que devolve valor (`auth.controller.ts`). Regressão registrada em nestjs/nest#18709. A versão fica exata para um `npm update` não trazer a 12.6.1. Conferido em 2026-11-25. | Sair a correção (PR nestjs/nest#18710). Volte então ao `^` na latest dos quatro, juntos |
| `argon2` | `^0.45` | 0.45.2 | É 0.x, mas tem anos de produção. O Argon2id é o algoritmo nº 1 do OWASP para senhas. | — (exceção à regra "≥ 1.0") |

## Combinações que quebram

- `@nestjs/typeorm` 10 e 11.0.0 quebram na inicialização com o TypeORM 1.x. Use o `@nestjs/typeorm` 12 ou superior.

## Atualização automática

O Dependabot (`.github/dependabot.yml`) abre os PRs de atualização. O porquê das escolhas está na [ADR 0012](../adr/0012-cadeia-de-suprimentos-do-ci.md).

| Ecossistema | Onde | Título do PR | Grupos | Cooldown |
| --- | --- | --- | --- | --- |
| `npm` | `package.json` e `package-lock.json`, com `versioning-strategy: increase` (a faixa do `package.json` sobe junto) e até 10 PRs abertos | `build(deps)` e `build(deps-dev)` | `nestjs` (`@nestjs/*`), `opentelemetry` (`@opentelemetry/*`), `testcontainers` (`testcontainers`, `@testcontainers/*`), `typescript-eslint` (`typescript-eslint`, `@typescript-eslint/*`) e `vitest` (`vitest`, `@vitest/*`), com todos os tipos de update. O resto vem avulso | 3 dias para patch e minor, 7 para major |
| `github-actions` | Os workflows de `.github/workflows/` e a composite `.github/actions/setup`, até 5 PRs abertos | `ci(deps)` | `actions`, com todas | 3 dias |
| `docker-compose` | As imagens do `docker-compose.yml`, até 5 PRs abertos | `build(deps)` | Nenhum: uma imagem por PR | 3 dias |

- **Agenda:** toda segunda-feira, às 06:00 de `America/Sao_Paulo`, nos três.
- **Cooldown:** o Dependabot só propõe uma versão publicada há pelo menos esse tempo. Não vale para os security updates, que saem na hora.
- **Exceções:** o `ignore` do `.github/dependabot.yml` espelha a [tabela de exceções](#exceções), na mesma faixa: a versão quebrada do Nest, o TypeScript de 6.1 em diante e as majors de `keyv`, `@keyv/redis` e `ioredis`. O `argon2` não tem `ignore`. Uma linha nova, mudada ou removida na tabela muda o `ignore` no mesmo PR.
- **Actions:** o PR do Dependabot atualiza também o `.github/workflows/actions.lock` ([Comandos → CI](comandos.md#ci)).
- **Imagens:** o PR do Dependabot muda só o `docker-compose.yml`. Quem o fecha completa as outras ocorrências na mesma branch:
  - `postgres:19`: `.github/workflows/ci.yml` (`services:`) e `test/global-setup/int.ts`;
  - `redis:8`: `.github/workflows/ci.yml` e `test/helpers/redis.ts`;
  - `axllent/mailpit:v1`: `.github/workflows/ci.yml` e `src/modules/notifications/infra/adapters/smtp-email-sender.int-spec.ts`.

  Numa major do Postgres, o volume de dados não abre na versão nova e precisa ser recriado: [Como resetar o ambiente local](../how-to/resetar-o-ambiente-local.md).
- **Node:** o `.nvmrc`, o `ARG NODE_VERSION` do `Dockerfile` e o `engines` do `package.json` ficam fora do Dependabot e são conferidos à mão.
- **Conferência manual:** o `npm outdated` continua valendo, com o resultado descrito na [Regra](#regra).
