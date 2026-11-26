# Plano dos how-tos de erro de domínio, serviço externo e rota protegida (#60)

A issue #60 pede três how-tos para tarefas comuns que hoje se montam juntando uma explicação, uma referência e o código dos módulos de exemplo: lançar um erro de domínio novo, integrar um serviço externo e proteger uma rota. Cada um segue o padrão do PR #58: intro de uma frase, só passos, o porquê como link para a explicação e os fatos na referência. Pronto quando as três páginas existem com `type: how-to`, o `docs/README.md` e as rotas do `AGENTS.md` apontam para elas e o `npm run ci` passa, inclusive o `docs:check`.

**Mudanças em relação ao texto da issue:**

- **A base não tem rota protegida nem regra de dono.** O `@Roles` só aparece no catalog, e a regra de dono só no orders (`order-access.ts`), os dois removíveis ([ADR 0008](../adr/0008-projeto-template-com-modulos-de-exemplo.md)). Na base, o 401 e o 403 só existem no `GuardProbeController` dos testes. O how-to de rota usa o orders e o catalog como modelo, como os how-tos de cache e de evento já fazem, e o `auth.e2e-spec.ts` como modelo do teste do guard.
- **O retry e a tradução do erro só existem no orders.** O `SmtpEmailSender` (notifications, base) mostra o port, o adapter, o prazo, a variável e a ligação no módulo, mas não tem retry nem tradução de erro, porque a fila repete o envio. O `ResilientPaymentGateway` (orders) é o modelo do retry, do decorator e do erro 503. O how-to usa os dois, com os passos do retry e da tradução condicionais.
- **Nenhuma rota protegida documenta o 401 e o 403 no OpenAPI, e quase nenhum erro de domínio aparece lá.** O `@ApiProblemResponse` só é usado no `auth.controller.ts`, e nem o 409 do cadastro está no `openapi.json`. Este PR fica só em Markdown. O how-to de erro traz o `@ApiProblemResponse` como passo condicional, e uma issue nova cobre a lacuna das rotas que já existem.

Tudo entra em **um PR**, na branch `docs/how-tos-de-erro-servico-externo-e-rota`. O registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

## Decisões

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-26, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Escopo do PR | Só documentação. Nenhum controller, DTO ou `openapi.json` muda |
| Lacuna do OpenAPI | Issue nova, aberta com o ok do dono no passo 6: documentar o 401 e o 403 das rotas protegidas e os erros de domínio de cada rota com `@ApiProblemResponse`, regerando o `openapi.json`. O how-to de erro já ensina o passo para a rota nova |
| Nomes no plop | `npm run plop doc how-to "lançar um erro de domínio"`, `"integrar um serviço externo"` e `"proteger uma rota"`. Os arquivos saem `lancar-um-erro-de-dominio.md`, `integrar-um-servico-externo.md` e `proteger-uma-rota.md` |
| Exemplos do how-to de erro | Só da base: o `EmailAlreadyInUseError` do identity, o `IDENTITY_ERROR_STATUSES`, o `register-and-login.use-case.spec.ts` e o `auth.e2e-spec.ts` com o `expectProblemJson` |
| Exemplos do how-to de serviço externo | O `SmtpEmailSender` e o `FakeEmailSender` para o caminho básico, e o `ResilientPaymentGateway` com o `PaymentUnavailableError` para o retry e a tradução. Sem circuit breaker: o how-to linka a linha dele em Evoluções com gatilho |
| Exemplos do how-to de rota | O `orders.controller.ts` (`@CurrentUser`, `@ApiBearerAuth`), o `order-access.ts` (regra de dono no caso de uso) e o `products.controller.ts` (`@Roles`). Testes: o `auth.e2e-spec.ts` para o 401 e o 403 de role, e o `orders.e2e-spec.ts` para o 403 de dono |
| Rotas do `AGENTS.md` | O caminho de cada how-to entra na linha que já existe para o assunto: "Lançar ou mudar um erro…", "Integrar um fornecedor externo…" e "Mexer em login, tokens, guards, roles ou regra de dono". Sem linhas novas |
| Índice do `docs/README.md` | Os três juntos, depois de "Como criar um seed", na ordem erro, serviço externo e rota |
| Links de volta | A intro de cada explicação e referência do assunto ganha "Os passos estão em […]", como a do `redis.md` |
| Ensaio dos passos | Cada how-to é seguido de ponta a ponta numa branch descartável antes do PR. O que não funcionar como escrito volta para a página |
| Fluxo de entrega | O `/simplify` é pulado, porque o PR não muda código. O `/code-review` roda sobre as páginas |
| Tipo do commit e do PR | `docs` |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| 401, 403 e erros de domínio das rotas existentes no OpenAPI | Issue nova (passo 6) |
| Rota protegida ou regra de dono na base, para o how-to não depender do orders | Nenhum. O how-to de remoção dos exemplos já diz o que fazer com o código de exemplo usado como modelo |
| Circuit breaker e biblioteca de resiliência | Já estão em Evoluções com gatilho |

## Referências

- Issue #60: `gh issue view 60`.
- Gerador e regras: `plopfile.mjs` (gerador `doc`, que cria só o arquivo, sem mexer no índice), `plop-templates/doc/how-to.md.hbs`, `scripts/remark-docs-rules.mjs` (o `type` igual à pasta, nenhum comentário do template sobrando e os caminhos citados no `AGENTS.md` existindo) e [Como escrever uma página](../README.md#como-escrever-uma-página).
- How-tos de modelo: `docs/how-to/cachear-uma-leitura.md`, `docs/how-to/publicar-um-evento-de-integracao.md` e `docs/how-to/adicionar-uma-variavel-de-ambiente.md`.
- Erro de domínio:
  - código: `src/shared/domain/domain-error.ts`, `src/modules/identity/domain/errors/email-already-in-use.error.ts`, `src/modules/identity/infra/http/error-statuses.ts`, `src/modules/identity/infra/identity.module.ts` (`provideErrorStatuses`), `src/shared/infra/http/error-status.registry.ts`, `src/shared/infra/http/problem-details.filter.ts` e `src/shared/infra/http/problem-details.response.ts` (`ApiProblemResponse`);
  - testes: `src/modules/identity/application/register-and-login.use-case.spec.ts`, `test/auth.e2e-spec.ts` e `test/helpers/problem.ts`;
  - páginas: `docs/reference/respostas-de-erro.md`, `docs/explanation/modelagem-do-dominio.md`, `docs/reference/camadas.md` (linhas "Erro" e "Mapa de status") e as páginas dos módulos em `docs/reference/modules/`.
- Serviço externo:
  - código: `src/modules/notifications/application/ports/email-sender.ts`, `src/modules/notifications/infra/adapters/smtp-email-sender.ts`, `src/modules/notifications/infra/notifications.module.ts` (`useFactory`), `src/shared/infra/resilience/` (`with-timeout.ts` e `retry.ts`), `src/modules/orders/application/ports/payment-gateway.ts`, `src/modules/orders/infra/gateways/resilient-payment.gateway.ts` e `src/modules/orders/infra/orders.module.ts`;
  - testes: `test/fakes/fake-email-sender.ts`, `src/modules/notifications/infra/adapters/smtp-email-sender.int-spec.ts` e `src/modules/orders/infra/gateways/resilient-payment.gateway.spec.ts`;
  - páginas: `docs/explanation/servicos-externos.md`, `docs/how-to/adicionar-uma-variavel-de-ambiente.md`, `docs/reference/camadas.md` (linhas "Port" e "Adapter") e `docs/reference/testes.md`.
- Rota protegida:
  - código: `src/shared/infra/auth/` (`auth.module.ts`, `jwt-auth.guard.ts`, `roles.guard.ts` e os decorators `public`, `roles` e `current-user`), `src/shared/application/actor.ts`, `src/modules/orders/infra/http/orders.controller.ts`, `src/modules/orders/application/order-access.ts`, `src/modules/catalog/products.controller.ts` e `plop-templates/module/controller.hbs`;
  - testes: `test/auth.e2e-spec.ts` (bloco do guard global), `test/helpers/guard-probe.controller.ts`, `test/helpers/auth.ts` (`registerAndLogin` e `setRoles`) e `test/orders.e2e-spec.ts`;
  - páginas: `docs/reference/autenticacao.md#rotas-protegidas` e `docs/explanation/autenticacao.md`.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): o `docs/README.md` e o `AGENTS.md` com a #62, em linhas diferentes. Esta trilha entra por último na onda 4: faça rebase e confira as duas tabelas.

## Como usar

- Execute os passos em ordem, um commit por passo que muda arquivo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal ([docs/README.md](../README.md#como-escrever-uma-página)).
- Cite o código pelo nome da classe e do arquivo, e não por número de linha, que muda.
- Os links dos passos 2 a 4 estão escritos a partir deste plano (`../how-to/…`). Na página, eles ficam relativos a `docs/how-to/`.
- Push, abertura de PR, issue nova e comentário na issue só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | How-to de erro de domínio | ✅ |
| 3 | How-to de serviço externo | ✅ |
| 4 | How-to de rota protegida | ✅ |
| 5 | Índice, rotas e links de volta | ✅ |
| 6 | Ensaio, verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha L a partir da `main`, com a branch `docs/how-tos-de-erro-servico-externo-e-rota`, e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)). Este plano já está na `main`.
2. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #60 como 🟡.
3. Commit: `docs(plan): começa os how-tos de erro, serviço externo e rota (#60)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: how-to de erro de domínio

1. `npm run plop doc how-to "lançar um erro de domínio"`.
2. Intro: "Use este guia quando uma regra do domínio precisa recusar uma operação com uma resposta HTTP própria."
3. Pré-requisitos: o módulo já tem o `infra/http/error-statuses.ts` registrado com o `provideErrorStatuses` (o `plop module` gera os dois).
4. Passos:
   1. A classe em `domain/errors/<nome>.error.ts`, subclasse do `DomainError`, com o `code` em `UPPER_SNAKE` e a mensagem em inglês, no molde do `EmailAlreadyInUseError`.
   2. Onde lançar: no domínio, quando a regra é da entidade ou do value object; no caso de uso, quando depende de outro dado. Link para [Modelagem do domínio](../explanation/modelagem-do-dominio.md).
   3. O status no mapa do módulo. Se o código não entrar no mapa, a resposta sai 422 com um `warn`, e um código já registrado com outro status derruba a subida. Link para [Registro de status](../reference/respostas-de-erro.md).
   4. Se o controller documenta as respostas da rota, um `@ApiProblemResponse(status, descrição)` nela e `npm run openapi:generate` ([Como atualizar o contrato OpenAPI](../how-to/atualizar-o-contrato-openapi.md)).
   5. O código na tabela de erros da página do módulo em `docs/reference/modules/`.
   6. Testes: o unitário do domínio ou do caso de uso com `rejects.toThrow(<Erro>)`, e o e2e com `expectProblemJson` e o `status`, o `code` e o `detail` no corpo, no molde do `auth.e2e-spec.ts`.
5. Como verificar: `npm test -- <padrão>`, `npm run test:e2e -- <padrão>` e `npm run openapi:check` quando o passo do OpenAPI se aplica.
6. Veja também: [Respostas de erro](../reference/respostas-de-erro.md) e [Modelagem do domínio](../explanation/modelagem-do-dominio.md).
7. `npm run docs:check`.
8. Commit: `docs: how-to para lançar um erro de domínio (#60)`.

### Passo 3: how-to de serviço externo

1. `npm run plop doc how-to "integrar um serviço externo"`.
2. Intro: "Use este guia quando um módulo precisa chamar um fornecedor fora da aplicação, como um gateway de pagamento ou um serviço de e-mail."
3. Passos:
   1. O port em `application/ports/`, como classe abstrata (ela é o token de injeção), com tipos do módulo e nada do fornecedor, no molde do `EmailSender`. Se a operação cobra ou cria algo, o port leva uma chave de idempotência, como o `PaymentGateway`.
   2. O adapter em `infra/adapters/` ou `infra/gateways/`, com a configuração pelo construtor e o `withTimeout` em toda chamada, no molde do `SmtpEmailSender`. O `withTimeout` não cancela a chamada: link para [Serviços externos](../explanation/servicos-externos.md).
   3. Se a chamada é idempotente e roda numa requisição HTTP: um decorator com `retry` e `withTimeout` que traduz qualquer falha num `DomainError` com status 5xx, no molde do `ResilientPaymentGateway`. Se roda num handler de fila, sem retry no adapter, porque a fila repete.
   4. As variáveis de ambiente: [Como adicionar uma variável de ambiente](../how-to/adicionar-uma-variavel-de-ambiente.md).
   5. A ligação no módulo, com `useFactory` e `ConfigService`, como no `notifications.module.ts`.
   6. Testes: um fake em `test/fakes/` para os unitários de quem usa o port, um unitário do decorator com um inner roteirizado (molde do `resilient-payment.gateway.spec.ts`) e, quando houver container do fornecedor ou um simulador, um int-spec com Testcontainers que confere o envio e a falha dentro do prazo (molde do `smtp-email-sender.int-spec.ts`).
4. Como verificar: `npm test -- <padrão>`, `npm run test:int -- <padrão>` e `npm run arch` (o port não importa nada da infra).
5. Veja também: [Serviços externos](../explanation/servicos-externos.md), com o circuit breaker que ainda não existe, e [Camadas](../reference/camadas.md).
6. `npm run docs:check`.
7. Commit: `docs: how-to para integrar um serviço externo (#60)`.

### Passo 4: how-to de rota protegida

1. `npm run plop doc how-to "proteger uma rota"`.
2. Intro: "Use este guia quando uma rota nova precisa de login, de um papel ou de ser restrita ao dono do recurso."
3. Passos:
   1. Exigir login: nada a fazer, porque o guard é global. Só o `@Public()` libera uma rota. `@ApiBearerAuth()` no controller, como o `plop module` já gera.
   2. Usar o ator: `@CurrentUser() actor: Actor`, passado ao caso de uso, como no `orders.controller.ts`.
   3. Restringir por papel: `@Roles('admin')` na rota, como no `products.controller.ts`.
   4. Restringir ao dono: a regra fica no caso de uso, e não num guard. Busca o recurso, responde 404 se não existe e lança o erro de dono (403) se o ator não é o dono nem `admin`, no molde do `order-access.ts`. Numa listagem, o filtro pelo ator vai na consulta. O erro novo segue o how-to do passo 2 (`lancar-um-erro-de-dominio.md`). Link para [Autenticação e ownership](../explanation/autenticacao.md).
   5. Testes: o unitário do caso de uso com outro ator, e o e2e com `registerAndLogin`, `setRoles` e o `enable-outbox-worker` importado antes do `AppModule`, conferindo o 401 sem token, o 403 de papel e o 403 de dono (moldes no `auth.e2e-spec.ts` e no `orders.e2e-spec.ts`).
4. Como verificar: `npm test -- <padrão>` e `npm run test:e2e -- <padrão>`. Os usuários de teste estão em [Autenticação](../reference/autenticacao.md).
5. Veja também: [Autenticação](../reference/autenticacao.md#rotas-protegidas) e [Autenticação e ownership](../explanation/autenticacao.md).
6. `npm run docs:check`.
7. Commit: `docs: how-to para proteger uma rota (#60)`.

### Passo 5: índice, rotas e links de volta

1. `docs/README.md`: os três na lista de how-tos, depois de "Como criar um seed", cada um com a descrição de uma linha.
2. `AGENTS.md`: o caminho de cada how-to na linha da tabela de rotas indicada em [Decisões](#decisões).
3. "Os passos estão em […]" na intro de:
   - `docs/explanation/modelagem-do-dominio.md` e `docs/reference/respostas-de-erro.md` (erro);
   - `docs/explanation/servicos-externos.md` (serviço externo);
   - `docs/explanation/autenticacao.md` e `docs/reference/autenticacao.md` (rota).
4. `npm run docs:check`.
5. Commit: `docs: índice, rotas do AGENTS.md e links para os how-tos novos (#60)`.

### Passo 6: ensaio, verificação, revisão, registro e PR

1. Ensaio, numa branch descartável a partir desta, sem push:
   - erro: um `DisplayNameTakenError` de mentira no identity, com o status, o unitário e um e2e, seguindo só o how-to;
   - serviço externo: um port e um adapter de mentira com prazo, um fake e o unitário;
   - rota: uma rota de mentira com `@Roles` e regra de dono, com o e2e do 401 e dos dois 403.

   Rode os comandos do "Como verificar" de cada página. O que não funcionar como escrito volta para a página, num commit `docs: ajusta o how-to de <assunto> depois do ensaio (#60)`. Apague a branch descartável no fim.
2. `npm run ci`.
3. Pule a skill `/simplify` (o PR não muda código) e rode a `/code-review` sobre as páginas (fluxo de entrega do `AGENTS.md`). Diga na descrição do PR que o `/simplify` foi pulado e por quê.
4. Faça rebase sobre a `main`, confira as linhas do `docs/README.md` e do `AGENTS.md` que a #62 também mexe, e rode `npm run ci` de novo.
5. Com o ok do dono, abra a issue da lacuna do OpenAPI (`documentation`, `prioridade: baixa`), com as rotas sem 401, 403 e erros de domínio e o `@ApiProblemResponse` como caminho. Ponha a issue no roadmap.
6. Com o ok do dono, faça push e abra o PR com o título `docs: how-tos de erro de domínio, serviço externo e rota protegida (#60)`. A descrição traz as mudanças em relação à issue, o resultado do ensaio e o número da issue do OpenAPI.
7. Com o ok do dono, deixe na issue um comentário de registro com este plano e os mesmos pontos da descrição.
8. Último commit da branch, `docs(plan): fecha o plano dos how-tos de erro, serviço externo e rota (#60)`:
   - apague este plano;
   - no roadmap, marque a #60 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #60, como os das outras issues;
   - rode `npm run docs:check` de novo e faça push.
