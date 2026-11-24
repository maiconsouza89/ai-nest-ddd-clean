# Plano do projeto template: CI, verificação de e-mail e README

O repositório passa a ser um template público (`maiconsouza89/ai-nest-ddd-clean`). A base que acompanha todo projeto é o `shared`, o identity e o notifications. O orders, o catalog e o inventory são exemplos que quem usa o template pode remover. Para a base ficar de pé sem os exemplos e o template provar que funciona, o trabalho tem três entregas, cada uma num PR:

- **CI:** hoje não há `.github/` nem badge de build. O CI roda só os testes afetados pelo PR, para o tempo de CI não crescer com o projeto.
- **Verificação de e-mail e boas-vindas:** hoje o notifications só reage ao `orders.order-paid`. Sem o orders, ele fica sem função. O identity passa a pedir a verificação do e-mail com um código e a dar boas-vindas, e o notifications envia os dois e-mails por SMTP.
- **Template:** o README apresenta o projeto como template, com badges, licença, um how-to para remover os exemplos e a ADR da decisão.

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Base e exemplos | Base: `shared`, identity e notifications. Exemplos removíveis: orders, catalog e inventory, mais o handler de pedido pago do notifications |
| Documentação presa aos exemplos | Fica como está neste plano. O how-to de remoção lista o que quebra. Descolar a documentação dos exemplos é trabalho futuro |
| CI em PR | `check` (typecheck, lint, format, docs e arch) no projeto inteiro. `unit` e `integration` com `vitest --changed origin/main`. PR só de Markdown pula os testes |
| CI na `main` | Tudo inteiro, como rede de segurança contra o que o grafo de imports não enxerga |
| Matriz do Node | `unit` em 22.22.3 (mínimo do `engines`, que subiu de 22.13 em 2026-11-24) e na versão do `.nvmrc`. `check` e `integration` só no `.nvmrc` |
| E2E no CI | Fora: depende do docker-compose |
| Termos | "Verificar o e-mail" e "código de verificação" (`verifyEmail`, `VerificationCode`). "Confirmar" já é do orders e do notifications |
| Login sem verificação | Recusado com `EMAIL_NOT_VERIFIED` |
| Código | 6 dígitos, 10 minutos (`EMAIL_VERIFICATION_CODE_TTL_SECONDS`), no máximo 5 tentativas erradas, uso único, um código novo invalida o anterior. Guardado só como hash, no Postgres |
| Rotas | `POST /v1/auth/verify-email` (204) e `POST /v1/auth/resend-verification-code` (sempre 202, intervalo mínimo de 60 s). Verificar não abre sessão |
| E-mails | No register, o e-mail com o código. Depois de verificar, as boas-vindas |
| Código no evento | Viaja em texto puro no `identity.verification-code-issued` v1 e fica na outbox até a limpeza de 7 dias. Aceito e registrado na ADR 0009 |
| Usuários existentes | O template sempre começa do zero: a migration não preenche contas antigas. Os usuários de teste dos seeds nascem verificados |
| E-mail | `SmtpEmailSender` (Nodemailer) em todos os ambientes, com `SMTP_URL` e `EMAIL_FROM`. Mailpit no compose. O `LoggingEmailSender` sai. O e2e lê o código pela API do Mailpit |
| Nome | `ai-nest-ddd-clean`. Os docs passam a citar os volumes como `<pasta>_*` |
| Licença | MIT |
| Badges | Dinâmicos: CI, licença, `engines.node`, `@nestjs/core` e `typescript`. Estáticos, sem versão: PostgreSQL, Redis, BullMQ, Vitest, OpenTelemetry e ESM. Extras: "Use this template" e "Docs: Diátaxis". Sem cobertura |

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**. O **Pronto quando** é o critério de aceite: o passo só é marcado quando todos os itens dele forem conferidos.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. As mais usadas aqui: `docs/reference/comandos.md`, `docs/reference/testes.md`, `docs/reference/modules/identity.md`, `docs/reference/modules/notifications.md`, `docs/reference/autenticacao.md`, `docs/how-to/publicar-um-evento-de-integracao.md`, `docs/how-to/gerar-uma-migration.md`, `docs/how-to/adicionar-uma-variavel-de-ambiente.md` e `docs/reference/versoes-e-excecoes.md`.
- Antes de adicionar uma dependência ou usar uma API nova dela (Nodemailer, `GenericContainer` do Testcontainers, opções do Vitest, actions do GitHub), consulte o Context7, como pede o `AGENTS.md`.
- Uma fase só termina com `npm run ci`, `npm run test:int` e `npm run test:e2e` passando, e depois de `/simplify` e `/code-review` sobre as mudanças dela (fluxo de entrega do `AGENTS.md`).
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Push, criação do repositório no GitHub e mudança de configuração dele só com o ok do dono do repositório.
- Quando todas as fases estiverem ✅, apague este arquivo, tire a rota dele do `AGENTS.md` e atualize a seção "Fora dos quadrantes" do `docs/README.md`. O registro fica no histórico do git.

## Mapa

| Fase | O que entrega | Status |
| --- | --- | --- |
| 1. CI | GitHub Actions com `check`, `unit` em matriz e `integration`, rodando só o que o PR afeta | ✅ |
| 2. Verificação de e-mail | Código de verificação, login bloqueado até verificar, e-mails de código e de boas-vindas por SMTP, Mailpit no compose | ✅ |
| 3. Template | README com badges, LICENSE MIT, nome novo, how-to de remoção dos exemplos e ADR 0008 | ⬜ |

A ordem importa: o CI vem primeiro para validar os PRs seguintes, e o README vem por último para descrever a base como ela ficou.

---

## Fase 1: CI

> **Status:** ✅ Concluída · **Início:** 2026-11-24 · **Conclusão:** 2026-11-24
>
> - [x] Passo 1: Vitest pronto para o `--changed`
> - [x] Passo 2: workflow do GitHub Actions
> - [x] Passo 3: documentação e primeira execução no GitHub

### Passo 1: Vitest pronto para o `--changed`

**Por quê:** o `--changed <ref>` roda só os testes ligados por import aos arquivos alterados. O que é carregado por glob ou por caminho fica fora do grafo de imports: uma migration nova não dispara nenhum teste de integração, porque o data source carrega a pasta por glob. O `forceRerunTriggers` roda a suíte inteira quando um desses arquivos muda. Por padrão ele cobre só `**/package.json`, `**/vitest.config.*` e `**/vite.config.*`.

**Faça:**

- No `vitest.config.ts`, `forceRerunTriggers` com os padrões mais `**/package-lock.json`, `**/tsconfig*.json`, `**/migrations/**`, `.env.example`, `docker-compose.yml` e `.github/workflows/**`. Um comentário curto diz por que cada grupo está ali.
- Procure no código o que mais é carregado por glob ou por caminho e não por import (seeds, `test/setup-env.ts`, `ENV_FILES` em `load-env-files.ts`, entidades do TypeORM por glob, se houver). Acrescente o que encontrar à lista, ou registre no **Como ficou** por que ficou de fora.
- Um PR que não afeta nenhum teste não pode falhar por "No test files found": use `--passWithNoTests` nos comandos do CI (passo 2), não no `npm test` local.

**Pronto quando:**

- Numa branch com uma mudança só em `src/modules/catalog/`, `npx vitest run --project unit --changed main` roda os testes do catalog e não os do orders.
- Numa branch que só cria um arquivo em `src/modules/identity/infra/database/typeorm/migrations/`, `npx vitest run --project int --changed main` roda todos os testes de integração.
- Numa branch que só muda um `.md`, `npx vitest run --project unit --changed main --passWithNoTests` termina com código 0 sem rodar testes.
- `npm run ci` passa.

**Como ficou:**

- A lista parte de `configDefaults.forceRerunTriggers` (no Vitest 5.1 é `**/package.json` e `**/{vitest,vite}.config.*`) em vez de repetir os padrões.
- O `test/setup-env.ts` ficou fora: o Vitest já trata o `setupFiles` como gatilho (conferido: mudar só ele seleciona os 37 unitários sem estar na lista). Os seeds não têm teste. O `ENV_FILES` só é lido pelo `load-env-files.spec.ts`, que usa arquivos temporários. As entidades do TypeORM entram por import nos data sources e nos helpers, não por glob. Nada mais entrou.
- O catalog não tem teste unitário (só `typeorm-catalog.facade.int-spec.ts`). Mudando `typeorm-catalog.facade.ts`, o `unit` seleciona zero arquivos e o `int` só o int-spec do catalog. Para provar a seleção com testes reais: mudando `refresh-token.entity.ts`, o `unit` roda 3 de 37 arquivos, todos do identity.
- Migration nova em `identity/.../migrations/` seleciona os 16 de 16 int-specs. PR só de `.md` termina com "No affected test files found" e código 0.
- Conferido num worktree descartável, sem commits: a config nova entrou com `git update-index --assume-unchanged`, porque com ela alterada (ou com uma config com outro nome) o Vitest roda tudo.
- Corrigido no `/code-review`: `.env.example`, `docker-compose.yml` e `.github/workflows/**` sem o prefixo `**/` nunca casavam, porque o Vitest compara com o caminho absoluto. Com o prefixo, mudar cada um deles, o `tsconfig.json`, o `package-lock.json` ou uma migration seleciona os 37 unitários. A regra do `**/` ficou no comentário da config e em `testes.md`.
- `npm run ci` passa.

### Passo 2: workflow do GitHub Actions

**Por quê:** jobs separados devolvem o resultado do `check` e do `unit` antes da integração, que sobe containers e é a mais lenta. Um job que falha é repetido sozinho. O filtro de PR só de Markdown fica num job, e não no gatilho do workflow, para os checks obrigatórios continuarem aparecendo num PR de docs.

**Faça:**

- `.github/workflows/ci.yml`, disparado em `push` na `main` e em `pull_request`, com `concurrency` por branch que cancela a execução anterior do mesmo PR.
- Job `changes`: compara o PR com a `main` (`git diff --name-only origin/main...HEAD`) e expõe uma saída `code` que é falsa quando todos os arquivos alterados são `**/*.md` ou estão em `docs/`. Prefira um passo de shell a uma action de terceiros.
- Job `check`: `npm ci` e `npm run ci` sem os unitários. Se for preciso, crie um script `ci:static` com typecheck, lint, format:check, docs:check e arch, e faça o `ci` chamá-lo, para a lista não ficar duplicada.
- Job `unit`: matriz com o mínimo do `engines` e a versão do `.nvmrc`. Em PR, `npx vitest run --project unit --changed origin/main --passWithNoTests`. Na `main`, `npm test`. Pulado quando `changes.code` é falso.
- Job `integration`: Node do `.nvmrc`. Em PR, `npx vitest run --project int --changed origin/main --passWithNoTests`. Na `main`, `npm run test:int`. Pulado quando `changes.code` é falso.
- Checkout com `fetch-depth: 0` nos jobs que usam o `--changed`. `actions/setup-node` com `cache: npm` e `node-version-file: .nvmrc` (ou a versão da matriz).
- Use a versão estável mais recente de cada action, conferida na documentação oficial, e fixe pela tag maior (`@vN`).

**Pronto quando:**

- O arquivo passa no `actionlint` (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest`).
- `npm run ci` passa, e o `ci` local continua rodando as mesmas verificações de antes.

**Como ficou:**

- `actions/checkout@v7` e `actions/setup-node@v7`, as maiores estáveis em 2026-11-24 (v7.0.1 e v7.1.0, conferidas nas releases do GitHub; o Context7 lista o checkout até a v7).
- `ci:static` criado. O `ci` passou a ser `ci:static && npm test`: as mesmas verificações, com o `arch` agora antes dos unitários. A linha do `ci` em `docs/reference/comandos.md` foi ajustada já neste passo, porque citava a ordem antiga. O resto da documentação fica para o passo 3.
- A base do diff é `HEAD^1`, e não `origin/main`: em PR o checkout é o merge do PR na base, e o primeiro pai dele é a ponta da base. Com isso o checkout usa `fetch-depth: 2`, e não o histórico inteiro, e funciona também num PR empilhado. Os argumentos ficam numa variável só (`VITEST_ARGS`), vazia fora de PR, e cada job roda um passo só: `npm test -- ...` e `npm run test:int -- ...`, reaproveitando os scripts. Na `main`, o `changes` não faz checkout e sai com `code=true`. (Ajustes do `/simplify`; a conferir nos PRs de teste do passo 3.)
- A matriz do `unit` usa `include` com `node-version` (`22.22.3`) numa entrada e `node-version-file` (`.nvmrc`) na outra: a chave ausente vira string vazia, e o `setup-node` usa a outra. O nome do job é `unit (Node 22.22.3)` ou `unit (Node .nvmrc)`.
- `engines.node` subiu de `>=22.13` para `>=22.22.3`, com o ok do dono, depois do `/code-review`: o OpenTelemetry pede `>=22.15`, e o testcontainers e o `@nestjs/schematics` pedem até `^22.22.3`. O `npm ci` só avisa (EBADENGINE), e um job verde em 22.13 sugeria um suporte que não existe. README, `comandos.md` e o tutorial foram junto. Isso cumpre a condição da linha do `module.register` em `evolucoes-com-gatilho.md`, que fica para um passo à parte. Os unitários em 22.22.3 não rodaram localmente (o download do Node foi bloqueado): a primeira prova é o job da matriz no passo 3.
- O filtro do job `changes` é um `grep -vE '\.md$|^docs/'` sobre o diff: só `.md`/`docs/` dá `false`; qualquer outro arquivo, inclusive `.github/workflows/ci.yml`, dá `true`. Fora de PR, `true` sempre.
- `permissions: contents: read` no workflow inteiro. O grupo do `concurrency` é o número do PR ou, na `main`, o `run_id` (ajuste do `/code-review`): com um grupo só para a `main`, uma terceira execução descartaria a pendente, e o `head_ref` misturava PRs de forks com o mesmo nome de branch.
- Sem fail-fast entre jobs, de propósito: todos os resultados saem de uma vez, e só o `cancel-in-progress` corta uma execução. A decisão, as alternativas e o gatilho para rever ficaram na seção "CI" de `docs/reference/evolucoes-com-gatilho.md`.
- actionlint 1.7.12 sem erros, Prettier ok e `npm run ci` passa.

### Passo 3: documentação e primeira execução no GitHub

**Por quê:** o comportamento só se prova no GitHub. A documentação precisa dizer o que roda em PR e na `main`, para ninguém estranhar um PR verde que não rodou um teste.

**Faça:**

- `docs/reference/comandos.md`: seção "CI", com os jobs, o que cada um roda em PR e na `main`, o filtro de Markdown, a lista do `forceRerunTriggers` e a ausência de fail-fast entre jobs, com link para a linha de `docs/reference/evolucoes-com-gatilho.md`.
- `docs/reference/testes.md`: o que o `--changed` enxerga, o que ele não enxerga e o que fazer ao criar um arquivo carregado por glob (acrescentar ao `forceRerunTriggers`).
- Com o ok do dono: crie o remote `maiconsouza89/ai-nest-ddd-clean`, faça push da `main` e abra os três PRs de teste abaixo. Feche-os sem merge depois de conferir.

**Pronto quando:**

- O push na `main` roda `check`, `unit` (nas duas versões) e `integration` inteiros, e todos passam.
- Um PR que só muda um `.md` roda o `check` e pula `unit` e `integration`. O PR fica verde.
- Um PR que muda só um arquivo do catalog roda no `unit` só os testes do catalog. Confira no log do job.
- Um PR que acrescenta uma migration vazia roda todos os testes de integração.
- `npm run docs:check` passa.

**Como ficou (parte local):**

- `docs/reference/comandos.md`: seção "CI" com a tabela dos jobs (PR, `main` e Node), o filtro de Markdown, a suíte inteira pelo `forceRerunTriggers`, a falta de fail-fast com link para `evolucoes-com-gatilho.md#ci` e o que fica fora do CI (e2e e `docs:links`).
- `docs/reference/testes.md`: seção "Só os testes afetados", com o que o `--changed` enxerga, o que não enxerga e o que fazer com um arquivo novo carregado por glob.
- Conferido num worktree descartável antes de escrever: o `--changed` segue imports por alias `#...` (mudar `money.vo.ts` seleciona os specs do orders), mas não um import usado só como tipo (mudar `catalog.facade.ts` não seleciona o `catalog-price.adapter.spec.ts`, porque a `CatalogFacade` só anota tipos lá). Isso ficou registrado em `testes.md`, com o `typecheck` do `check` como rede.
- `npm run docs:check` e o Prettier passam.
- Achado do `/simplify`, com o ok do dono: o gatilho `**/migrations/**` fica, mas não prova que a migration foi testada, porque os int-specs recebem a lista do helper. A correção de fundo ficou em `evolucoes-com-gatilho.md` (seção "CI"). `.env.example`, `docker-compose.yml` e os workflows continuam na lista.
- Com o ok do dono: push da `main` como está, e este branch num PR, que é a primeira execução do workflow.

**Como ficou (GitHub, 2026-11-24):**

- Repositório `maiconsouza89/ai-nest-ddd-clean` criado privado (fica público no passo 15). Push da `main` sem o workflow, e a Fase 1 no PR #1.
- PR #1 (muda o `ci.yml`, então suíte inteira): `check`, `unit` em 22.22.3 e no `.nvmrc` com 37 de 37 arquivos, `integration` com 16 de 16. O Node 22.22.3 baixou e passou sem EBADENGINE.
- Os PRs de teste saíram do `feat/ci-github-actions` e apontaram para ele, o que também prova a base `HEAD^1` num PR empilhado. Fechados sem merge, branches apagados:
  - #2, só `README.md`: `check` verde, `unit` e `integration` pulados, PR verde.
  - #3, só `typeorm-catalog.facade.ts`: `unit` com "No affected test files found" nas duas versões (o catalog não tem unitário), `integration` com 1 arquivo, o int-spec do catalog.
  - #4, migration vazia no identity: `integration` 16 de 16 e, pelo mesmo gatilho, `unit` 37 de 37.
- Achado: quando o `unit` é pulado, a matriz não expande, e o check aparece com o nome literal `unit (Node ${{ (matrix.node-version || '.nvmrc') }})`. Um check obrigatório `unit (Node 22.22.3)` ficaria esperando para sempre num PR de docs. Corrigido com o ok do dono: job `ci`, com `needs` nos outros quatro e `if: always()`, que falha só se um deles falhou ou foi cancelado. É o único check a marcar como obrigatório (`comandos.md#ci`).
- PR #5, só `README.md`, depois do job `ci`: `unit` e `integration` pulados e `ci` verde. O PR #1 com o `ci` também ficou todo verde. Fechado sem merge, branch apagado.
- Push do merge na `main` (`aabdbc3`): suíte inteira, sem `--changed`. `check`, `unit` 37 de 37 em 22.22.3 e no `.nvmrc`, `integration` 16 de 16 e `ci`, todos verdes.
- Tempo do PR #1: `check` 80 s, `unit` ~45 s, `integration` 112 s (30 s de `npm ci` e 71 s de testes, quase todo subindo containers, um arquivo por vez). Com o ok do dono, o container compartilhado ficou em `evolucoes-com-gatilho.md`, com o gatilho de 5 minutos.
- Fechamento da fase: `npm run ci` e `npm run test:int` verdes no CI (PR #1 e `main`), `npm run test:e2e` local com 8 de 8 arquivos e 58 testes, `/simplify` e `/code-review` aplicados antes do primeiro commit. O `ci` virou check obrigatório da `main` pelo `npm run github:setup`, criado depois da fase com o ok do dono: o ruleset "branch padrão" foi aceito no repositório privado, e a segunda execução atualizou o mesmo ruleset.

---

## Fase 2: verificação de e-mail e boas-vindas

> **Status:** ✅ Concluída · **Início:** 2026-11-24 · **Conclusão:** 2026-11-24
>
> - [x] Passo 4: regras do código de verificação no domínio
> - [x] Passo 5: persistência do código e do `emailVerifiedAt`
> - [x] Passo 6: casos de uso e eventos do identity
> - [x] Passo 7: SMTP com Mailpit
> - [x] Passo 8: e-mails do notifications
> - [x] Passo 9: rotas HTTP, seeds e testes de ponta a ponta
> - [x] Passo 10: documentação e ADR 0009

### Passo 4: regras do código de verificação no domínio

**Por quê:** validade, tentativas e uso único são invariantes. Elas ficam na entidade, testadas sem banco, e não espalhadas nos casos de uso.

**Faça:**

- No `User`: `emailVerifiedAt: Date | null` e `verifyEmail(now)`, idempotente para quem já está verificado. `User.register` nasce com `null`.
- Entidade `VerificationCode` em `domain/entities/`: `userId`, `codeHash`, `expiresAt`, `attempts`, `usedAt` e `createdAt`. Métodos para conferir um código (incrementa `attempts` no erro, marca `usedAt` no acerto) e para saber se ainda aceita tentativas (não vencido, não usado, `attempts < 5`).
- O código em texto puro só existe na emissão: a entidade recebe o hash. A geração dos 6 dígitos e o hash ficam atrás de um port em `application/ports/`, seguindo o `OpaqueTokenGenerator`. O adapter usa `crypto.randomInt`.
- Erros de domínio: `EMAIL_NOT_VERIFIED` e `INVALID_VERIFICATION_CODE`. O segundo cobre código errado, vencido, usado, esgotado e e-mail desconhecido, com a mesma mensagem.
- Hora sempre pelo `Clock`, como o resto do identity.

**Pronto quando:** os testes de unidade cobrem: código certo dentro do prazo, código errado (incrementa `attempts`), a quinta tentativa errada e a sexta recusada mesmo com o código certo, código vencido, código já usado e `verifyEmail` repetido. `npm test -- verification-code` e `npm test -- user.entity` passam.

**Como ficou:**

- O `User` passou a estender o `AggregateRoot`: o `verifyEmail(now)` anota o evento de domínio `EmailVerified`, que vira o `identity.email-verified` no passo 6. Repetir não muda a data nem anota de novo.
- `VerificationCode.issue` (como o `RefreshToken.startFamily`), `verify(codeHash, now)` e `acceptsAttemptsAt(now)`. No `/simplify`, a regra dos 60 s entre códigos também foi para a entidade (`allowsResendAt`), e o `Email` ganhou o `tryCreate`, que substituiu três cópias do try/catch de `InvalidEmailError` (login, verificação e reenvio).
- Port `VerificationCodeGenerator`, com o `CryptoVerificationCodeGenerator` (`randomInt` e SHA-256) e o `FakeVerificationCodeGenerator` em `test/fakes/`.
- Os testes cobrem os casos do critério e mais o intervalo de reenvio. `npm test -- verification-code` e `npm test -- user.entity` passam.

### Passo 5: persistência do código e do `emailVerifiedAt`

**Por quê:** o código é gravado na mesma transação do usuário e da outbox. Se o register falhar depois de gravar o código, nada sai.

**Faça:**

- ORM entity e migration de `identity.email_verification_codes`: `id`, `userId` (FK com `ON DELETE CASCADE`), `codeHash`, `expiresAt`, `attempts`, `usedAt`, `createdAt`, com índice em `userId`. Siga `docs/how-to/gerar-uma-migration.md` e as regras de ORM entity de `docs/reference/convencoes.md`.
- Coluna `users.emailVerifiedAt` (`timestamptz`, nula, sem preenchimento).
- Repositório no domínio (`VerificationCodeRepository`), com a implementação TypeORM e a in-memory. O código ativo é o mais recente do usuário. Emitir um novo invalida os anteriores (marque-os como usados na mesma transação).
- Mapper do `User` com o campo novo.
- Atualize `test/helpers/identity-database.ts` se ele listar tabelas.

**Pronto quando:** `npm run mig:identity:run` aplica as migrations num banco do compose recém-criado, e um teste de integração do repositório confere: gravar e ler o código ativo, emitir um segundo invalida o primeiro, e apagar o usuário apaga os códigos. `npm run test:int -- verification-code` passa.

**Como ficou:**

- Sem mapper, como o `RefreshToken`: as props da entidade são as colunas (`convencoes.md` atualizado). O repositório tem `add` (invalida os anteriores e grava o novo), `findLatestForUpdate` (o mais recente, com `FOR UPDATE`) e `save` (tentativas e uso).
- Migration `1795545972474-add-email-verification`, gerada e renomeada; um segundo `gen` não acha diferença. O `identity-database.ts` ganhou a entidade, a migration e as da outbox, que o passo 6 usa.
- Conferido: `mig:identity:run` e o `db:setup` inteiro num banco do compose recém-criado, numa cópia do repositório em outra pasta (outro projeto do Compose, sem tocar nos volumes do dono). O int-spec cobre os três casos do critério, a data da verificação lida do banco e 10 tentativas erradas simultâneas que param em 5.
- Achado do `/code-review`: o teste de concorrência usava um hash curto, que a coluna `char(64)` completa com espaços, e a última asserção passava de qualquer jeito. Passou a usar o hash real.

### Passo 6: casos de uso e eventos do identity

**Por quê:** é a primeira vez que o identity publica eventos. O desenho segue `docs/how-to/publicar-um-evento-de-integracao.md`, como o orders faz.

**Faça:**

- `RegisterUserUseCase`: na mesma transação, cria o usuário, emite o código e grava `identity.verification-code-issued` v1 na outbox (`userId`, `email`, `name`, `code`, `expiresAt`).
- `ResendVerificationCodeUseCase`: e-mail desconhecido ou já verificado termina sem erro e sem evento. Abaixo de 60 s desde o último código, também termina sem erro e sem evento. Caso contrário, emite um código novo e grava o evento. O resultado é sempre o mesmo para quem chama.
- `VerifyEmailUseCase`: confere o código, marca o usuário como verificado e grava `identity.email-verified` v1 (`userId`, `email`, `name`) na mesma transação. O erro é sempre `INVALID_VERIFICATION_CODE`. Grave o incremento de `attempts` mesmo quando o código está errado: o erro não pode desfazer a contagem.
- `LoginUseCase`: com a senha certa e e-mail não verificado, lança `EMAIL_NOT_VERIFIED`. Com a senha errada, continua `INVALID_CREDENTIALS`, para não revelar se a conta existe e se está verificada.
- `EMAIL_VERIFICATION_CODE_TTL_SECONDS` (padrão 600) pela validação do env, seguindo `docs/how-to/adicionar-uma-variavel-de-ambiente.md`.
- Contratos em `src/modules/identity/contracts/events/`, com exemplos versionados e teste de contrato, no padrão do orders.

**Pronto quando:**

- Testes de unidade dos quatro casos de uso cobrem: register grava usuário, código e evento; reenvio dentro de 60 s, para e-mail desconhecido e para conta verificada não grava evento; verificação com código certo grava o evento, e com código errado incrementa `attempts` e lança o erro; login de conta não verificada com senha certa dá `EMAIL_NOT_VERIFIED`, e com senha errada dá `INVALID_CREDENTIALS`.
- Um teste de integração confere que o register grava o código e a linha da outbox na mesma transação, e que uma falha depois do usuário não deixa nenhum dos três.
- Os testes de contrato dos dois eventos passam.

**Como ficou:**

- O `VerificationCodeIssuer`, helper da raiz de `application/` como o `SessionIssuer`, gera o código, grava o hash e publica o `identity.verification-code-issued` direto, sem evento de domínio: a entidade só conhece o hash. O register e o reenvio o usam. O `identity.email-verified` segue o how-to (`to-integration-event.ts` e `publish-user-events.ts`).
- O erro da verificação sai depois da transação, como no refresh: lançado dentro dela, desfaria a contagem da tentativa.
- Achado do `/code-review` (importante): a verificação lia o usuário fora da transação, e o `save`, que grava todas as colunas, podia desfazer uma troca de roles feita no meio. O `UserRepository` ganhou o `findByIdForUpdate`, e a verificação e o reenvio releem o usuário travado dentro da transação. Isso também fecha o reenvio que corria com a verificação ou com outro reenvio.
- Testes: unitários dos quatro casos de uso, contrato dos dois eventos e dois int-specs (`register-user.int-spec.ts`: usuário, hash e evento juntos, e nada sobra quando a outbox falha depois de gravar).

### Passo 7: SMTP com Mailpit

**Por quê:** um template precisa de um adapter de e-mail real. O Mailpit mostra no navegador o e-mail que o usuário final recebe, sem enviar nada para fora.

**Faça:**

- Antes de instalar: confira o Nodemailer em `docs/reference/versoes-e-excecoes.md` e no Context7 (versão estável, API de transporte por URL e tipos).
- `SmtpEmailSender` em `src/modules/notifications/infra/adapters/`, implementando o `EmailSender`. Com timeout na conexão e no envio, seguindo `docs/explanation/servicos-externos.md`. Uma falha lança erro, e a fila reentrega o evento.
- `SMTP_URL` e `EMAIL_FROM` obrigatórias na validação do env. Valores do `.env.example` e do `test/setup-env.ts` apontam para o Mailpit local (`smtp://127.0.0.1:1025`).
- Serviço `mailpit` no `docker-compose.yml`: SMTP em `127.0.0.1:1025`, interface web em `127.0.0.1:8025`, com healthcheck. O Quickstart sobe `postgres redis mailpit`.
- Apague o `LoggingEmailSender` e crie o `FakeEmailSender` em `test/fakes/`, que guarda as mensagens enviadas.
- Teste de integração do `SmtpEmailSender` contra o Mailpit num `GenericContainer` do Testcontainers. Se o pacote `testcontainers` não for dependência direta, acrescente-o ao `devDependencies`.

**Pronto quando:**

- O teste de integração envia um e-mail e o encontra pela API do Mailpit, com destinatário, assunto e corpo certos.
- Com o Mailpit parado, o envio falha dentro do timeout, sem pendurar o teste.
- `docker compose up -d mailpit` sobe o serviço, e `http://localhost:8025` abre.
- Sem `SMTP_URL` no `.env`, a app não sobe, e a validação do env cita a variável na mensagem.

**Como ficou:**

- Nodemailer 10.6.1, conferido no Context7. Ele traz os próprios tipos, então o `@types/nodemailer` não entrou. `testcontainers` 12.2.2 virou dependência direta. Mailpit pela tag maior `axllent/mailpit:v1` (v1.34 em 2026-11-24, no Docker Hub), como `postgres:19` e `redis:8`.
- `SmtpEmailSender` com os prazos de fase do Nodemailer (5 s de conexão e saudação, 10 s de socket) e um `withTimeout` de 15 s no envio inteiro. O `SMTP_URL` é validado como `smtp://` ou `smtps://`. O spec do env passou a partir de uma base com as obrigatórias.
- Conferido: o int-spec acha o e-mail no Mailpit com remetente, destinatário, assunto e corpo; com o servidor fora do ar, falha na hora (`ECONNREFUSED`); `docker compose up -d mailpit` sobe com healthcheck e `http://localhost:8025` responde 200; sem `SMTP_URL`, a app para com `Invalid environment configuration` citando a variável.
- O `.env` local do dono não tinha as variáveis novas: as duas linhas do `.env.example` foram acrescentadas a ele. A entrada morta do `logging-email-sender.ts` saiu do `eslint.config.mjs`.

### Passo 8: e-mails do notifications

**Por quê:** o notifications passa a ter função própria na base, ligada ao identity, e o handler de pedido pago vira exemplo removível.

**Faça:**

- `SendVerificationCodeEmailUseCase`: assunto "Seu código de verificação", corpo com o código e a validade.
- `SendWelcomeEmailUseCase`: assunto "Boas-vindas, `<nome>`".
- Handlers `OnVerificationCodeIssuedHandler` (consumidor `notifications.email-on-verification-code-issued`) e `OnEmailVerifiedHandler` (`notifications.email-on-email-verified`), pelo `IdempotentConsumer`, importando só os tipos dos contratos do identity.
- O destinatário vem do payload. O `RecipientDirectory` continua só para o pedido pago.
- Testes de contrato do lado do consumidor contra os exemplos do identity.

**Pronto quando:** testes de unidade dos dois casos de uso, com o `FakeEmailSender`, conferem destinatário, assunto e corpo. Os testes de contrato dos dois consumidores passam. Um teste de integração confere que a mesma entrega duas vezes envia um e-mail só.

**Como ficou:**

- O e-mail do código diz a validade em minutos, calculada de `occurredAt` a `expiresAt`. Depois do `/code-review`, o `EMAIL_VERIFICATION_CODE_TTL_SECONDS` exige no mínimo 60, para o texto nunca dizer "0 minutos".
- O `RecipientDirectory` foi para junto do handler de pedido pago no `notifications.module.ts`, com um comentário marcando os dois como exemplo removível.
- Testes: `send-identity-emails.use-case.spec.ts`, `identity-email.handlers.spec.ts` (consumidor contra os exemplos do identity) e `identity-email.handlers.int-spec.ts`, com a marca de processado no Postgres.

### Passo 9: rotas HTTP, seeds e testes de ponta a ponta

**Por quê:** com o login bloqueado, todo fluxo que faz register e login (o helper de auth do e2e, o e2e `primeiro-pedido` e o tutorial) passa a verificar o e-mail no meio.

**Faça:**

- No `AuthController`: `POST /v1/auth/verify-email` com `{ email, code }` (204) e `POST /v1/auth/resend-verification-code` com `{ email }` (202). DTOs com `class-validator`: `code` com exatamente 6 dígitos.
- No filtro de erros do identity: `EMAIL_NOT_VERIFIED` 403 e `INVALID_VERIFICATION_CODE` 400.
- Seeds: os usuários de teste nascem com `emailVerifiedAt` preenchido.
- Helper de e2e que busca o código na API do Mailpit pelo destinatário. O `test/helpers/auth.ts` passa a fazer register, verificar e login.
- Tutorial `docs/tutorials/01-do-clone-ao-primeiro-pedido.md`: subir o Mailpit, abrir `http://localhost:8025`, copiar o código e chamar o `verify-email` antes do login. O e2e `primeiro-pedido` espelha o tutorial.

**Pronto quando:**

- `npm run test:e2e -- auth` cobre: register, login recusado com 403 e `EMAIL_NOT_VERIFIED`, verificação com código errado (400), verificação com o código do Mailpit (204), login aceito, e-mail de boas-vindas no Mailpit, reenvio respondendo 202 para e-mail desconhecido.
- `npm run test:e2e` passa inteiro, incluindo o `primeiro-pedido`.
- Seguindo o tutorial à mão num ambiente zerado (`docs/how-to/resetar-o-ambiente-local.md`), cada comando dá a resposta que a página mostra.
- O Swagger em `/docs` mostra as duas rotas novas com os códigos de resposta.

**Como ficou:**

- O e2e usa o SMTP de verdade contra o Mailpit do compose: o `outbox` e o `primeiro-pedido` deixaram de trocar o `EmailSender` por um fake e leem os e-mails pelo `test/helpers/mailpit.ts`. O código sai por evento, então os e2e que usam o `registerAndLogin` (`auth`, `orders`, `catalog`) passaram a importar o `enable-outbox-worker`.
- No `/simplify`, o helper do Mailpit passou a consultar só a busca no laço de espera e a baixar o corpo uma vez, e o int-spec do SMTP passou a usá-lo.
- O seed, além de criar os usuários verificados, verifica as contas de teste que um banco antigo tinha sem verificação (achado do `/code-review`; conferido no banco do compose).
- Conferido: `npm run test:e2e` com 8 de 8 arquivos e 63 testes; o tutorial seguido à mão, passo a passo, num ambiente zerado na cópia em outra pasta, com cada resposta igual à da página e os três e-mails no Mailpit; o login de `user@example.com` do seed; e o `/docs-json` com 204 e 400 no `verify-email`, 202 no reenvio e 401 e 403 no login.
- Tutorial renumerado: o passo 6 é a verificação, e o e-mail de confirmação, antes lido no log, é lido no Mailpit (passo 12).

### Passo 10: documentação e ADR 0009

**Por quê:** o identity mudou de contrato, e duas decisões (login bloqueado e código em texto puro no evento) surpreendem sem contexto.

**Faça:**

- `docs/reference/modules/identity.md`: linguagem ubíqua ("verificar o e-mail", "código de verificação"), rotas, invariantes, eventos publicados, tabela nova, variável e o código no payload.
- `docs/reference/modules/notifications.md`: os dois eventos consumidos, o termo "e-mail de boas-vindas", o `SmtpEmailSender` no lugar do `LoggingEmailSender`, e o handler de pedido pago marcado como exemplo.
- `docs/reference/autenticacao.md`: as rotas novas, os erros e o passo de verificação. `docs/explanation/autenticacao.md`, se o fluxo descrito lá mudar.
- `docs/reference/variaveis-de-ambiente.md`: `EMAIL_VERIFICATION_CODE_TTL_SECONDS`, `SMTP_URL` e `EMAIL_FROM`.
- `docs/reference/comandos.md`: o Mailpit no setup do zero e os endereços da app.
- `docs/reference/glossario.md`: os termos novos no índice.
- `docs/adr/0009-verificacao-de-email-com-codigo-no-evento.md`: login bloqueado até verificar, e o código em texto puro no evento e na outbox por até 7 dias, com as alternativas recusadas (apagar o payload depois da entrega e o identity enviar o e-mail direto).
- Índice do `docs/README.md` com a ADR nova.

**Pronto quando:** `npm run docs:check` passa, as páginas citadas descrevem o comportamento que os testes do passo 9 provam, e nenhuma página cita o `LoggingEmailSender`.

**Como ficou:**

- Além das páginas listadas: `explanation/servicos-externos.md`, `reference/testes.md`, `reference/convencoes.md`, `how-to/resetar-o-ambiente-local.md`, o Quickstart do README e a linha do e2e no `AGENTS.md`.
- Nenhuma página cita o `LoggingEmailSender`. A ADR 0004 ainda cita o arquivo `logging-email-sender.ts`, mas ADRs são imutáveis (`docs/README.md`).
- Do `/code-review`, registrado nas docs em vez de mudar código: o código também fica nos jobs do BullMQ no Redis (ADR 0009 e `identity.md`); `SMTP_URL` e `EMAIL_FROM` passam a ser exigidas pelos scripts de migration e seed (`variaveis-de-ambiente.md`); o envio roda dentro da transação do `IdempotentConsumer` e segura uma conexão por até 15 s (`notifications.md`); e, num banco antigo, uma sessão aberta antes da migration continua renovando (ADR 0009).
- Fechamento da fase: `npm run ci`, `npm run test:int` (20 de 20 arquivos, 92 testes) e `npm run test:e2e` (8 de 8, 63 testes) passam, depois do `/simplify` e do `/code-review`.

---

## Fase 3: template

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 11: licença e nome do projeto
> - [ ] Passo 12: how-to para remover os módulos de exemplo
> - [ ] Passo 13: ADR 0008 e AGENTS.md
> - [ ] Passo 14: README com badges
> - [ ] Passo 15: repositório público e template no GitHub

### Passo 11: licença e nome do projeto

**Por quê:** sem licença ninguém pode usar o template. O nome do projeto precisa bater com o do repositório.

**Faça:**

- `LICENSE` com o texto MIT, o ano e o nome do autor. `"license": "MIT"` no `package.json`.
- `ai-nest-ddd-clean` no `name` do `package.json` (e no `package-lock.json`, por `npm install`) e no `OTEL_SERVICE_NAME` do `.env.example` e de `docs/reference/variaveis-de-ambiente.md`.
- Em `docs/reference/comandos.md` e `docs/how-to/resetar-o-ambiente-local.md`, os volumes passam de `ddd-clean-nest_*` para `<pasta>_*`, explicando que o Compose usa o nome da pasta.

**Pronto quando:** `grep -rn "ddd-clean-nest" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .` não encontra nada, e `npm run ci` passa.

### Passo 12: how-to para remover os módulos de exemplo

**Por quê:** remover um exemplo mexe em uns oito lugares. Um guia só serve se alguém o seguir do começo ao fim e a app continuar de pé.

**Faça:**

- `docs/how-to/remover-os-modulos-de-exemplo.md` (gere com `npm run plop doc`), com um passo por lugar: as pastas em `src/modules/`, os imports no `src/app.module.ts`, os scripts `mig:*` e `seed:*` do `package.json`, os helpers em `test/helpers/`, os e2e (`orders`, `catalog`, `primeiro-pedido`), o handler de pedido pago e o `RecipientDirectory` do notifications, as páginas em `docs/reference/modules/` e o índice do `docs/README.md`, e as menções no `AGENTS.md`.
- Uma seção que lista as páginas que continuam citando os exemplos (tutorial, `agregados.md`, `consistencia-e-eventos.md`, `camadas.md`, `comunicacao-entre-modulos.md` e as outras que o `docs:check` apontar), com o que fazer com cada uma: apagar, reescrever ou manter como leitura.
- Remover um exemplo só é possível porque nada da base depende dele. Confira com `npm run arch` e com um `grep` que o identity, o notifications (fora o handler de pedido pago) e o `shared` não importam o orders, o catalog nem o inventory.

**Pronto quando:** num worktree descartável (`git worktree add`), seguindo só o guia, sem conhecimento prévio: `npm run typecheck`, `npm run lint`, `npm run arch`, `npm test`, `npm run test:int` e `npm run test:e2e` passam, e as falhas do `docs:check` são exatamente as listadas no guia. Registre no **Como ficou** o que precisou ser corrigido no guia durante a conferência. Apague o worktree depois.

### Passo 13: ADR 0008 e AGENTS.md

**Por quê:** o propósito do repositório mudou. Um leitor futuro vai querer saber por que há módulos de exemplo em vez de um esqueleto vazio, e o agente precisa saber o que é base e o que é exemplo.

**Faça:**

- `docs/adr/0008-projeto-template-com-modulos-de-exemplo.md`: o que é base, o que é exemplo, por que os exemplos ficam no repositório (mostram agregado, CRUD sem camadas e reserva síncrona entre módulos funcionando e testados), a alternativa recusada (esqueleto vazio) e o custo aceito (a documentação ainda depende dos exemplos).
- `AGENTS.md`, seção "Projeto": base e exemplos no lugar da lista atual de módulos. Siga a skill `writing-for-agents` para a mudança.
- Índice do `docs/README.md` com a ADR nova e o how-to do passo 12.

**Pronto quando:** `npm run docs:check` passa, e o `AGENTS.md` diz, em uma frase, quais módulos são base e quais são exemplo.

### Passo 14: README com badges

**Por quê:** é a porta de entrada do template. Quem chega precisa entender em segundos o que vem pronto, o que pode apagar e como começar.

**Faça:**

- Estrutura, nesta ordem:
  1. Título `ai-nest-ddd-clean`, os badges e uma frase dizendo que é um template.
  2. O que vem pronto: o `shared` (banco, cache, filas, outbox, auth, observabilidade, jobs, rate limit), o identity (contas, login, sessões, verificação de e-mail) e o notifications (e-mails por SMTP).
  3. Módulos de exemplo: orders (agregado com itens, outbox, concorrência), catalog (CRUD direto, sem camadas) e inventory (reserva síncrona dentro da transação do pedido), com o link para o how-to do passo 12.
  4. Usar como template: o botão, o que renomear (o `name` do `package.json` e o `OTEL_SERVICE_NAME`), `npm run github:setup` para exigir o check `ci` na branch padrão, e o link para `docs/how-to/criar-um-modulo.md`.
  5. Requisitos, Quickstart (com o Mailpit), Antes de abrir um PR e Documentação, como hoje.
- Badges pelo shields.io, todos apontando para `maiconsouza89/ai-nest-ddd-clean`:
  - Dinâmicos: status do workflow `ci.yml` na `main`, licença, `engines.node` do `package.json`, versão de `@nestjs/core` e de `typescript` (`github/package-json/dependency-version`).
  - Estáticos, sem versão e com logo: PostgreSQL, Redis, BullMQ, Vitest, OpenTelemetry e ESM.
  - Extras: "Use this template" (link para `https://github.com/maiconsouza89/ai-nest-ddd-clean/generate`) e "Docs: Diátaxis" (link para `docs/README.md`).
  - Sem badge de cobertura.

**Pronto quando:**

- `npm run docs:check` passa, e `npm run docs:links` não aponta link quebrado no README (os badges dinâmicos só respondem depois do passo 15; anote a exceção no **Como ficou** se ele rodar antes).
- Cada seção da estrutura acima existe, na ordem.
- O Quickstart, seguido à mão num ambiente zerado, deixa a app no ar com `/health/live` respondendo e o Mailpit abrindo.

### Passo 15: repositório público e template no GitHub

**Por quê:** os badges dinâmicos e o botão "Use this template" só funcionam com o repositório público e marcado como template. Isso é configuração do GitHub, feita pelo dono do repositório.

**Faça:**

- Dono do repositório: deixar `maiconsouza89/ai-nest-ddd-clean` público e marcar *Template repository* em Settings → General.
- Depois disso, conferir os badges e o botão.

**Pronto quando:**

- Cada URL de badge do README responde 200 com um SVG que não diz "repo not found", "invalid" nem "inaccessible" (`curl -s <url> | grep -c "not found"` dá 0).
- O badge de CI mostra "passing".
- O botão "Use this template" abre a tela de criação de repositório no GitHub.
- Um repositório criado pelo botão, clonado do zero, passa no Quickstart e no `npm run ci`.
