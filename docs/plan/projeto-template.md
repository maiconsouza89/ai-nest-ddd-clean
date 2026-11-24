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
| Matriz do Node | `unit` em 22.13 e na versão do `.nvmrc`. `check` e `integration` só no `.nvmrc` |
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
| 1. CI | GitHub Actions com `check`, `unit` em matriz e `integration`, rodando só o que o PR afeta | ⬜ |
| 2. Verificação de e-mail | Código de verificação, login bloqueado até verificar, e-mails de código e de boas-vindas por SMTP, Mailpit no compose | ⬜ |
| 3. Template | README com badges, LICENSE MIT, nome novo, how-to de remoção dos exemplos e ADR 0008 | ⬜ |

A ordem importa: o CI vem primeiro para validar os PRs seguintes, e o README vem por último para descrever a base como ela ficou.

---

## Fase 1: CI

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: Vitest pronto para o `--changed`
> - [ ] Passo 2: workflow do GitHub Actions
> - [ ] Passo 3: documentação e primeira execução no GitHub

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

### Passo 2: workflow do GitHub Actions

**Por quê:** jobs separados devolvem o resultado do `check` e do `unit` antes da integração, que sobe containers e é a mais lenta. Um job que falha é repetido sozinho. O filtro de PR só de Markdown fica num job, e não no gatilho do workflow, para os checks obrigatórios continuarem aparecendo num PR de docs.

**Faça:**

- `.github/workflows/ci.yml`, disparado em `push` na `main` e em `pull_request`, com `concurrency` por branch que cancela a execução anterior do mesmo PR.
- Job `changes`: compara o PR com a `main` (`git diff --name-only origin/main...HEAD`) e expõe uma saída `code` que é falsa quando todos os arquivos alterados são `**/*.md` ou estão em `docs/`. Prefira um passo de shell a uma action de terceiros.
- Job `check`: `npm ci` e `npm run ci` sem os unitários. Se for preciso, crie um script `ci:static` com typecheck, lint, format:check, docs:check e arch, e faça o `ci` chamá-lo, para a lista não ficar duplicada.
- Job `unit`: matriz com `22.13` e a versão do `.nvmrc`. Em PR, `npx vitest run --project unit --changed origin/main --passWithNoTests`. Na `main`, `npm test`. Pulado quando `changes.code` é falso.
- Job `integration`: Node do `.nvmrc`. Em PR, `npx vitest run --project int --changed origin/main --passWithNoTests`. Na `main`, `npm run test:int`. Pulado quando `changes.code` é falso.
- Checkout com `fetch-depth: 0` nos jobs que usam o `--changed`. `actions/setup-node` com `cache: npm` e `node-version-file: .nvmrc` (ou a versão da matriz).
- Use a versão estável mais recente de cada action, conferida na documentação oficial, e fixe pela tag maior (`@vN`).

**Pronto quando:**

- O arquivo passa no `actionlint` (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest`).
- `npm run ci` passa, e o `ci` local continua rodando as mesmas verificações de antes.

### Passo 3: documentação e primeira execução no GitHub

**Por quê:** o comportamento só se prova no GitHub. A documentação precisa dizer o que roda em PR e na `main`, para ninguém estranhar um PR verde que não rodou um teste.

**Faça:**

- `docs/reference/comandos.md`: seção "CI", com os jobs, o que cada um roda em PR e na `main`, o filtro de Markdown e a lista do `forceRerunTriggers`.
- `docs/reference/testes.md`: o que o `--changed` enxerga, o que ele não enxerga e o que fazer ao criar um arquivo carregado por glob (acrescentar ao `forceRerunTriggers`).
- Com o ok do dono: crie o remote `maiconsouza89/ai-nest-ddd-clean`, faça push da `main` e abra os três PRs de teste abaixo. Feche-os sem merge depois de conferir.

**Pronto quando:**

- O push na `main` roda `check`, `unit` (nas duas versões) e `integration` inteiros, e todos passam.
- Um PR que só muda um `.md` roda o `check` e pula `unit` e `integration`. O PR fica verde.
- Um PR que muda só um arquivo do catalog roda no `unit` só os testes do catalog. Confira no log do job.
- Um PR que acrescenta uma migration vazia roda todos os testes de integração.
- `npm run docs:check` passa.

---

## Fase 2: verificação de e-mail e boas-vindas

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 4: regras do código de verificação no domínio
> - [ ] Passo 5: persistência do código e do `emailVerifiedAt`
> - [ ] Passo 6: casos de uso e eventos do identity
> - [ ] Passo 7: SMTP com Mailpit
> - [ ] Passo 8: e-mails do notifications
> - [ ] Passo 9: rotas HTTP, seeds e testes de ponta a ponta
> - [ ] Passo 10: documentação e ADR 0009

### Passo 4: regras do código de verificação no domínio

**Por quê:** validade, tentativas e uso único são invariantes. Elas ficam na entidade, testadas sem banco, e não espalhadas nos casos de uso.

**Faça:**

- No `User`: `emailVerifiedAt: Date | null` e `verifyEmail(now)`, idempotente para quem já está verificado. `User.register` nasce com `null`.
- Entidade `VerificationCode` em `domain/entities/`: `userId`, `codeHash`, `expiresAt`, `attempts`, `usedAt` e `createdAt`. Métodos para conferir um código (incrementa `attempts` no erro, marca `usedAt` no acerto) e para saber se ainda aceita tentativas (não vencido, não usado, `attempts < 5`).
- O código em texto puro só existe na emissão: a entidade recebe o hash. A geração dos 6 dígitos e o hash ficam atrás de um port em `application/ports/`, seguindo o `OpaqueTokenGenerator`. O adapter usa `crypto.randomInt`.
- Erros de domínio: `EMAIL_NOT_VERIFIED` e `INVALID_VERIFICATION_CODE`. O segundo cobre código errado, vencido, usado, esgotado e e-mail desconhecido, com a mesma mensagem.
- Hora sempre pelo `Clock`, como o resto do identity.

**Pronto quando:** os testes de unidade cobrem: código certo dentro do prazo, código errado (incrementa `attempts`), a quinta tentativa errada e a sexta recusada mesmo com o código certo, código vencido, código já usado e `verifyEmail` repetido. `npm test -- verification-code` e `npm test -- user.entity` passam.

### Passo 5: persistência do código e do `emailVerifiedAt`

**Por quê:** o código é gravado na mesma transação do usuário e da outbox. Se o register falhar depois de gravar o código, nada sai.

**Faça:**

- ORM entity e migration de `identity.email_verification_codes`: `id`, `userId` (FK com `ON DELETE CASCADE`), `codeHash`, `expiresAt`, `attempts`, `usedAt`, `createdAt`, com índice em `userId`. Siga `docs/how-to/gerar-uma-migration.md` e as regras de ORM entity de `docs/reference/convencoes.md`.
- Coluna `users.emailVerifiedAt` (`timestamptz`, nula, sem preenchimento).
- Repositório no domínio (`VerificationCodeRepository`), com a implementação TypeORM e a in-memory. O código ativo é o mais recente do usuário. Emitir um novo invalida os anteriores (marque-os como usados na mesma transação).
- Mapper do `User` com o campo novo.
- Atualize `test/helpers/identity-database.ts` se ele listar tabelas.

**Pronto quando:** `npm run mig:identity:run` aplica as migrations num banco do compose recém-criado, e um teste de integração do repositório confere: gravar e ler o código ativo, emitir um segundo invalida o primeiro, e apagar o usuário apaga os códigos. `npm run test:int -- verification-code` passa.

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

### Passo 8: e-mails do notifications

**Por quê:** o notifications passa a ter função própria na base, ligada ao identity, e o handler de pedido pago vira exemplo removível.

**Faça:**

- `SendVerificationCodeEmailUseCase`: assunto "Seu código de verificação", corpo com o código e a validade.
- `SendWelcomeEmailUseCase`: assunto "Boas-vindas, `<nome>`".
- Handlers `OnVerificationCodeIssuedHandler` (consumidor `notifications.email-on-verification-code-issued`) e `OnEmailVerifiedHandler` (`notifications.email-on-email-verified`), pelo `IdempotentConsumer`, importando só os tipos dos contratos do identity.
- O destinatário vem do payload. O `RecipientDirectory` continua só para o pedido pago.
- Testes de contrato do lado do consumidor contra os exemplos do identity.

**Pronto quando:** testes de unidade dos dois casos de uso, com o `FakeEmailSender`, conferem destinatário, assunto e corpo. Os testes de contrato dos dois consumidores passam. Um teste de integração confere que a mesma entrega duas vezes envia um e-mail só.

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
  4. Usar como template: o botão, o que renomear (o `name` do `package.json` e o `OTEL_SERVICE_NAME`) e o link para `docs/how-to/criar-um-modulo.md`.
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
