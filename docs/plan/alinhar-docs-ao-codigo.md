# Plano de alinhamento da documentação ao código

Uma auditoria comparou cada afirmação de `docs/`, do `AGENTS.md` e do `README.md` com o código, e rodou `npm run ci`, `npm run test:int` e `npm run test:e2e` (todos passaram em 2026-11-23). As regras centrais batem: camadas, aliases, dependency-cruiser, autenticação, scripts, variáveis de ambiente e versões. O que sobrou cai em três grupos:

- **Bugs que a doc descreve certo e o código não cumpre:** `productId` malformado devolve 500, nome feito só de espaços passa na validação, e as migrations leem o `.env` em produção.
- **Doc imprecisa ou incompleta:** números e comportamentos de outbox, filas, `Idempotency-Key` e Redis, exceções de camada sem registro, shared kernel incompleto e frases que generalizam demais.
- **Registros velhos:** ponteiros para um "passo 18" que não existe, ADRs que não batem mais com o código e itens adiados fora do `evolucoes-com-gatilho.md`.

A fonte da verdade é o código, exceto quando a doc descreve uma regra de domínio, de segurança ou de consistência que o código quebra. Nesses casos o código é corrigido. Cada caso já foi decidido, e a decisão está no passo correspondente.

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**. O **Pronto quando** é o critério de aceite: o passo só é marcado quando todos os itens dele forem conferidos.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto.
- Uma fase só termina com `npm run ci` passando. As fases 1 e 6 também exigem `npm run test:int` e `npm run test:e2e`.
- Escreva de forma atemporal, como manda o `docs/README.md`: sem "hoje", "atualmente" ou "novo". Data só em registro.
- Ao fim de cada passo, registre um **Como ficou** curto: o que mudou em relação ao "Faça" e o que foi conferido.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- Quando todas as fases estiverem ✅, apague este arquivo e tire o link dele do `docs/README.md`. O registro fica no histórico do git.

## Mapa

| Fase | O que entrega | Status |
| --- | --- | --- |
| 0. Preparação | Branch e linha de base verde | ✅ |
| 1. Correções no código | Os três bugs, os adapters no lugar certo e os comentários corrigidos | ✅ |
| 2. Doc dos módulos, ferramentas e testes | Páginas de módulo, glossário, plano do pedido, comandos, testes e tutorial | ✅ |
| 3. Doc de infra e eventos | Consistência, Redis, observabilidade, how-tos e evoluções com gatilho | ⬜ |
| 4. Doc de arquitetura e ADRs | Camadas, convenções, shared kernel, arquitetura e ADRs 0002, 0004, 0005 e 0006 | ⬜ |
| 5. Redis fora do ar na prática | O `redis.md` conferido contra o comportamento real | ⬜ |
| 6. Entrega | Verificação completa, `/simplify`, `/code-review` e este plano apagado | ⬜ |

A fase 1 vem antes das de doc porque muda nomes de arquivo e comportamentos que a doc vai citar. As fases 2, 3 e 4 são independentes entre si. A fase 5 depende da 3, porque confere o texto que a 3 escreve.

---

## Fase 0: preparação

> **Status:** ✅ Concluída · **Início:** 2026-11-24 · **Conclusão:** 2026-11-24
>
> - [x] Passo 1: branch e linha de base

### Passo 1: branch e linha de base

**Por quê:** os testes e o `ci` passaram antes de qualquer mudança. Confirmar isso no ponto de partida separa uma falha causada por este trabalho de uma que já existia.

**Faça:**

- Crie a branch `fix/docs-vs-codigo` a partir da `main`.
- Rode `npm run ci`.
- Faça commits separados por assunto (código, doc por fase, ADRs). Sem push e sem PR: o dono do repositório revisa o diff e decide.

**Pronto quando:**

- [x] `git branch --show-current` mostra `fix/docs-vs-codigo`.
- [x] `npm run ci` passa.

**Como ficou:** branch criada a partir da `main` (`131ce7f`). O `npm run ci` passou com 195 testes unitários e nenhuma violação do dependency-cruiser.

---

## Fase 1: correções no código

> **Status:** ✅ Concluída · **Início:** 2026-11-24 · **Conclusão:** 2026-11-24
>
> - [x] Passo 1: `productId` malformado devolve 400
> - [x] Passo 2: trim antes da validação de tamanho
> - [x] Passo 3: DataSources da CLI ignoram o `.env` em produção
> - [x] Passo 4: adapters do identity e do inventory em `infra/adapters/`
> - [x] Passo 5: comentários de código desatualizados

### Passo 1: `productId` malformado devolve 400

**Por quê:** o `orders.md` promete `PRODUCT_NOT_FOUND` (404) para produto inexistente, e o `catalog.md` diz que o `pricesOf` deixa de fora os ids que não conhece. Com um id que não é uuid, por exemplo `"abc"`, o `In(productIds)` do `TypeOrmCatalogFacade` vai numa coluna `uuid`. O Postgres lança `invalid input syntax for type uuid`, e o `POST /v1/orders` responde 500.

**Faça:**

- Em `src/modules/orders/infra/http/dtos/create-order.request.ts`, troque o `@IsString()` do `productId` por `@IsUUID()`.
- Em `src/modules/catalog/typeorm-catalog.facade.ts`, no `pricesOf`, descarte os ids que não passam no `isUUID` antes da query, como fazem o `TypeOrmUserDirectoryFacade` e o `TypeOrmActorResolver`. Se nenhum id sobrar, devolva o resultado vazio sem consultar o banco.
- Em `test/orders.e2e-spec.ts`, acrescente o caso `productId: "abc"`, esperando 400.
- No `docs/reference/modules/orders.md`, registre que um `productId` que não é uuid devolve 400 de validação.

**Pronto quando:**

- [x] `npm run test:e2e -- orders` passa, com o caso novo devolvendo 400.
- [x] O `src/modules/catalog/typeorm-catalog.facade.int-spec.ts` tem um caso em que o `pricesOf(['abc', <uuid existente>])` devolve só o uuid existente, sem lançar erro, e `npm run test:int -- typeorm-catalog.facade` passa.
- [x] A página do orders cita o 400.

**Como ficou:** o caso e2e novo falhou com 500 antes da correção e passou com 400 depois (18 de 18). O caso de integração também confere que `pricesOf(['abc'])` devolve `[]` (3 de 3). Além do orders, o `catalog.md` passou a dizer que o `pricesOf` deixa de fora os ids que não são uuid.

### Passo 2: trim antes da validação de tamanho

**Por quê:** o `catalog.md` diz que o `name` tem de 1 a 120 caracteres e é salvo sem os espaços das pontas. O `@Length` valida o valor cru, e o trim só acontece no `products.service.ts`, então `"   "` passa e é salvo como `""`. No `identity`, o `@MaxLength(100)` do `RegisterRequest` também mede o valor cru, e um nome de 100 caracteres com espaços nas pontas recebe 400, embora o `identity.md` diga que os espaços não contam.

**Faça:**

- Crie um decorator `Trim()` em `src/shared/infra/http/`, com `@Transform` do `class-transformer`, que aplica `trim()` só quando o valor é string. O `ValidationPipe` já roda com `transform: true` (`src/app.setup.ts`).
- Aplique o `@Trim()` antes do `@Length` no `name` do `CreateProductRequest` e do `UpdateProductRequest` (`src/modules/catalog/dtos/product.request.ts`), e antes do `@MaxLength(100)` no `name` do `RegisterRequest` (`src/modules/identity/infra/http/dtos/identity.requests.ts`).
- Mantenha o trim do `products.service.ts` e do `user.entity.ts`: são quem garante a regra para quem não passa pelo HTTP.

**Pronto quando:**

- [x] Um teste de unidade do decorator cobre string com espaços, string só de espaços e valor que não é string.
- [x] `npm run test:e2e -- catalog` tem o caso `name: "   "` devolvendo 400, no `POST` e no `PATCH`.
- [x] `npm run test:e2e -- auth` tem o caso de cadastro com 100 caracteres e espaços nas pontas devolvendo 201, com o nome salvo sem os espaços.

**Como ficou:** o decorator ficou em `src/shared/infra/http/trim.decorator.ts`, com o spec ao lado (3 casos). Sem o `@Trim()` nos DTOs, os três casos e2e novos falharam; com ele, `catalog` e `auth` passaram (27 de 27). O caso do `auth` confere o nome direto em `identity.users`, porque nenhuma resposta da API devolve o nome. `typecheck` e `arch` passaram.

### Passo 3: DataSources da CLI ignoram o `.env` em produção

**Por quê:** o `variaveis-de-ambiente.md` diz que, com `NODE_ENV=production`, o `.env` é ignorado. O `app.module.ts` e o `tracing.ts` cumprem isso, mas os cinco DataSources da CLI de migrations chamam `config({ path: ['.env.local', '.env'] })` sem olhar o `NODE_ENV`, e o template do `plop` repete o padrão. Num deploy com um `.env` esquecido, a migration leria dele as variáveis que faltam no ambiente.

**Faça:**

- Crie em `src/shared/infra/config/` uma função `loadEnvFiles()` com a regra do `tracing.ts`: fora de produção, carrega `.env.local` e `.env`, e a primeira definição vence.
- Use essa função no `tracing.ts` e nos cinco DataSources:
  - `src/modules/catalog/database/catalog.data-source.ts`
  - `src/modules/identity/infra/database/typeorm/identity.data-source.ts`
  - `src/modules/inventory/infra/database/typeorm/inventory.data-source.ts`
  - `src/modules/orders/infra/database/typeorm/orders.data-source.ts`
  - `src/shared/infra/outbox/outbox.data-source.ts`
- Troque o `config(...)` do `plop-templates/module/data-source.hbs` pela mesma função.
- Se o `dotenv` deixar de ser importado em qualquer lugar, avalie tirá-lo das dependências (ver `docs/reference/versoes-e-excecoes.md`).

**Pronto quando:**

- [x] Um teste de unidade da função mostra que, com `NODE_ENV=production`, nenhum arquivo é lido, e que, fora de produção, uma variável que já está no ambiente não é sobrescrita.
- [x] `git grep -n "config({ path" -- src plop-templates` não acha nada.
- [x] `npm run db:setup` roda sem erro, e cada módulo diz "No migrations are pending".
- [x] `npm run plop module <nome-de-teste>` gera um DataSource que usa a função. Apague o módulo de teste depois, com `git checkout` e `git clean` só nos arquivos gerados.

**Como ficou:** a função ficou em `src/shared/infra/config/load-env-files.ts` e recebe o `processEnv` e os caminhos como parâmetros opcionais, para o teste usar arquivos temporários sem tocar no `process.env`. A opção `processEnv` do `dotenv` foi conferida nos tipos da versão instalada (18.0.10). O `dotenv` continua nas dependências, porque a função o usa. Conferido também na prática: com `NODE_ENV=production` e sem `DATABASE_URL` no ambiente, o `mig:catalog:run` falha na validação em vez de ler o `.env`. O módulo gerado pelo `plop` (`zzteste`) passou no `typecheck`. Rodar a migration dele, o que o passo não pedia, criou o schema e a tabela de migrations no banco do docker-compose; as duas migrations foram revertidas e a tabela apagada, e o banco ficou como antes. O `variaveis-de-ambiente.md` e o `adicionar-uma-variavel-de-ambiente.md` passaram a citar a função.

### Passo 4: adapters do identity e do inventory em `infra/adapters/`

**Por quê:** o `camadas.md` manda os adapters para `infra/adapters/`. Três arquivos estão direto na raiz de `infra/` sem motivo: o padrão saiu do lugar, não é uma decisão de design.

**Faça:**

- Com `git mv`, mova para `infra/adapters/`:
  - `src/modules/identity/infra/typeorm-user-directory.facade.ts`
  - `src/modules/identity/infra/typeorm-actor-resolver.ts`
  - `src/modules/inventory/infra/inventory-facade.impl.ts` e o spec dele, `inventory-facade.impl.spec.ts`
- Ajuste os imports em `identity.module.ts`, `identity-auth.module.ts`, `inventory.module.ts` e no spec.
- Não troque o nome do `inventory-facade.impl.ts` para `typeorm-…`. Ele não usa TypeORM: só embrulha o `ReserveStockUseCase` e traduz o erro de domínio, então o prefixo `typeorm-` mentiria.

**Pronto quando:**

- [x] `git grep -n "infra/typeorm-actor-resolver\|infra/typeorm-user-directory\|infra/inventory-facade" -- src test docs` não acha nada.
- [x] `npm run typecheck`, `npm run arch` e `npm test` passam.

**Como ficou:** os quatro arquivos foram movidos com `git mv`, e os imports relativos de dentro deles subiram um nível. O `git grep` só acha os caminhos antigos neste plano, que os cita de propósito. Nenhuma página de `docs/` citava os caminhos. `typecheck`, `arch` e `npm test` (200 testes) passaram.

### Passo 5: comentários de código desatualizados

**Por quê:** a auditoria encontrou comentários que contradizem a doc ou apontam para um lugar que não existe mais.

**Faça:**

- `src/tracing.ts` (por volta da linha 22): troque "passo 18 do plano" por um ponteiro para `docs/reference/evolucoes-com-gatilho.md`.
- `src/modules/notifications/infra/adapters/logging-email-sender.ts:7`: quem tenta de novo é a fila do BullMQ do consumidor, não a outbox.
- `src/shared/infra/messaging/bullmq-publisher.ts:22-26`: reescreva o JSDoc truncado ("Enfileira (a ordem…) o evento…").
- `src/shared/application/ports/actor-resolver.ts:3` e a regra `shared-nao-importa-modulos` do `.dependency-cruiser.js`: o port é ligado no `identity-auth.module.ts`, e o `AppModule` só repassa esse módulo para o `AuthModule.forRoot`.

**Pronto quando:**

- [x] `git grep -n "passo 18" -- src docs` não acha nada.
- [x] `git grep -n "ligado no .AppModule" -- src .dependency-cruiser.js` não acha nada.
- [x] `npm run ci` passa.
- [x] `npm run test:int` e `npm run test:e2e` passam (fecham a fase 1).

**Como ficou:** os quatro comentários e a regra do dependency-cruiser foram reescritos. O `git grep "passo 18"` não acha nada em `src`. Em `docs`, só acha a ADR 0004, que a fase 4 corrige, e este plano. Fechamento da fase: `npm run ci` passou com 200 testes unitários (195 + 3 do `Trim` + 2 do `loadEnvFiles`), `npm run test:int` com 80 (79 + 1) em 3 min 54 s, e `npm run test:e2e` com 58 (55 + 3).

---

## Fase 2: doc dos módulos, ferramentas e testes

> **Status:** ✅ Concluída · **Início:** 2026-11-24 · **Conclusão:** 2026-11-24
>
> - [x] Passo 1: páginas de módulo e glossário
> - [x] Passo 2: premissa do plano do pedido
> - [x] Passo 3: comandos, variáveis, testes e tutorial

### Passo 1: páginas de módulo e glossário

**Por quê:** o código está certo, e a doc está incompleta ou imprecisa.

**Faça:**

- `docs/reference/modules/inventory.md:29`: o "primeiro produto sem saldo" é o primeiro na ordem de `productId`, porque o `reserve-stock.use-case.ts` ordena os itens para evitar deadlock. Não é a ordem em que os itens vieram no pedido.
- `docs/reference/glossario.md:61`: um módulo importa o `contracts/` do outro **e** o Nest module dele nos `imports`, o que o `.dependency-cruiser.js` permite de propósito.
- `docs/reference/modules/identity.md:26`: a sessão também termina quando um token expira pelo próprio TTL (`REFRESH_TOKEN_TTL_SECONDS`) sem ser renovado, e quando o usuário é apagado (`ON DELETE CASCADE` em `refresh_tokens`).

**Pronto quando:**

- [x] As três frases descrevem o comportamento citado, cada uma apontando o arquivo do código onde ele está.
- [x] `npm run docs:check` passa.

**Como ficou:** no `inventory.md`, a célula da facade diz "na ordem de `productId`", e um item da lista abaixo dela explica a ordenação contra deadlock, citando o `reserve-stock.use-case.ts`. O glossário cita a regra `modulo-nest-so-importa-modulo-nest` do `.dependency-cruiser.js`. A linha "Sessão" do `identity.md` cita o `isDeadAt` da `refresh-token.entity.ts` para o TTL e o `onDelete: 'CASCADE'` da `refresh-token.orm-entity.ts`.

### Passo 2: premissa do plano do pedido

**Por quê:** o `docs/plan/ciclo-do-pedido.md:64` diz que "o `create` usa `addItem`". Na verdade é o `CreateOrderUseCase` que chama `Order.create` e depois `order.addItem` para cada item. Por isso o agregado não sabe se um `addItem` faz parte da criação.

**Faça:**

- Corrija a frase para descrever o fluxo real.
- No mesmo passo do plano, registre como decisão em aberto como o agregado vai separar "item da criação" de "item adicionado depois". O design fica para o trabalho daquele plano.

**Pronto quando:**

- [x] O passo 2 da fase 1 do `ciclo-do-pedido.md` não afirma mais que o `create` usa `addItem`, e lista a decisão em aberto.

**Como ficou:** o item "Cuidado" descreve o fluxo do `CreateOrderUseCase` (`Order.create` e depois `order.addItem` por item), e um item novo registra a decisão em aberto, a ser fechada no **Como ficou** daquele passo.

### Passo 3: comandos, variáveis, testes e tutorial

**Por quê:** frases que não batem com o código ou com o que os testes mostraram.

**Faça:**

- `docs/reference/variaveis-de-ambiente.md:72`: nos testes, só `DATABASE_URL` e `REDIS_URL` apontam para o docker-compose. O `JWT_SECRET` é uma string fixa (`test/setup-env.ts`).
- `docs/how-to/rodar-as-migrations-e-os-seeds.md:11`: os seeds aceitam `NODE_ENV=development` ou `test`.
- `docs/how-to/rodar-um-teste-especifico.md:82`: cada arquivo de integração sobe só o que usa (Postgres, Redis ou os dois).
- `docs/reference/comandos.md:57`: acrescente os checks do `docs:check` que faltam:
  - cada pasta de `src/modules/` precisa estar no índice de módulos do `docs/README.md`, e cada página de módulo precisa de um módulo;
  - `@caminho` é proibido no `AGENTS.md`;
  - os caminhos de `docs/` também são conferidos nos arquivos de `.claude/`.
- `docs/reference/comandos.md:67`: troque "cerca de 75 s" por uma frase sem número fixo, por exemplo "leva alguns minutos: cada arquivo sobe os containers de que precisa". Numa máquina com WSL2 levou 152 s.
- `docs/reference/testes.md:32`: em vez de "todo arquivo explica no topo", diga que os fakes e helpers que não são óbvios pelo nome explicam no topo o que fazem.
- `docs/tutorials/01-do-clone-ao-primeiro-pedido.md:13`: o `primeiro-pedido.e2e-spec.ts` segue o mesmo fluxo, mas cria um produto próprio em vez de usar o do seed.

**Pronto quando:**

- [x] `git grep -n "75 s" -- docs` não acha nada.
- [x] Cada frase listada corresponde ao comportamento descrito.
- [x] `npm run ci` passa (fecha a fase 2).

**Como ficou:** as sete frases foram reescritas. O `git grep "75 s"` só acha este plano. O how-to dos seeds cita o `run-seed.ts`, onde fica a lista de valores aceitos, e a linha do `docs:check` no `comandos.md` cita o `scripts/remark-docs-rules.mjs`. Na conferência, só 11 dos 30 arquivos de `test/fakes/` e `test/helpers/` têm um comentário antes da primeira declaração, o que confirma a frase nova do `testes.md`. `npm run ci` passou.

---

## Fase 3: doc de infra e eventos

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: cancelamento durante o pagamento
> - [ ] Passo 2: números e comportamentos da outbox, das filas e da `Idempotency-Key`
> - [ ] Passo 3: tabelas que nunca são limpas
> - [ ] Passo 4: Redis, log e how-tos
> - [ ] Passo 5: evoluções com gatilho

### Passo 1: cancelamento durante o pagamento

**Por quê:** o `consistencia-e-eventos.md:78` diz que um cancelamento ou expiração durante o pagamento "espera a linha, encontra o pedido já pago e falha". O cancelamento lê o pedido sem trava e ainda o vê pendente. Ele só fica esperando no `UPDATE ... WHERE version` do `save` e, depois do commit do pagamento, falha com `CONCURRENCY_CONFLICT` (409), não com `ORDER_NOT_CANCELLABLE`. A garantia de não cancelar um pedido cobrado continua valendo.

**Faça:** reescreva a frase com essa sequência, de forma coerente com o `docs/reference/modules/orders.md:101`.

**Pronto quando:**

- [ ] A seção "Trava pessimista quando o efeito não se desfaz" cita `CONCURRENCY_CONFLICT` como o erro do cancelamento ou da expiração que coincide com o pagamento.

### Passo 2: números e comportamentos da outbox, das filas e da `Idempotency-Key`

**Por quê:** a página explica os mecanismos, mas não dá nenhum número, e a regra de que uma `Idempotency-Key` vencida pode ser usada de novo não está escrita em lugar nenhum.

**Faça:** no `docs/explanation/consistencia-e-eventos.md`, acrescente de forma curta, citando o arquivo de cada constante:

- **Outbox** (`outbox-relay.ts`, `outbox-worker.ts`): lote de 50, até 8 tentativas, espera entre tentativas começando em 1 s e dobrando até 5 min. A outbox só roda com `OUTBOX_WORKER_ENABLED`. Ela espera 1 s só quando o lote vem incompleto; com um lote cheio, busca de novo na hora.
- **Jobs do BullMQ** (`bullmq-publisher.ts`): 10 tentativas com espera exponencial a partir de 2 s (cerca de 17 min no total). Concluídos ficam guardados por 24 h, os que falharam por 7 dias. As 24 h são a janela em que o `jobId` impede duplicata.
- **`Idempotency-Key`** (`pay-order.use-case.ts`, `typeorm-idempotency.store.ts`, `orders.module.ts`):
  - o header é opcional;
  - o prazo é 24 h, e depois dele a mesma chave pode ser usada de novo;
  - chave vazia ou com mais de 255 caracteres dá `INVALID_IDEMPOTENCY_KEY` (400);
  - chave reusada dá `IDEMPOTENCY_KEY_REUSED` (422);
  - as chaves ficam em `orders.idempotency_keys`, com chave primária (ator, chave).

**Pronto quando:**

- [ ] Cada número da lista aparece na página e bate com a constante do arquivo citado.
- [ ] A página diz que uma `Idempotency-Key` vencida pode ser usada de novo.
- [ ] A página cita `OUTBOX_WORKER_ENABLED`, e o link para a variável no `variaveis-de-ambiente.md` funciona.

### Passo 3: tabelas que nunca são limpas

**Por quê:** a seção "Limpeza" só fala dos eventos publicados, que são apagados de hora em hora depois de 7 dias. Três coisas nunca são apagadas: `shared.processed_events`, `orders.idempotency_keys` e as linhas mortas da outbox (`deadAt`). Implementar a limpeza fica fora desta auditoria.

**Faça:**

- Na seção "Limpeza", registre a retenção de 7 dias, a limpeza de hora em hora e as três tabelas que crescem sem limite. Diga que as linhas mortas da outbox ficam de propósito, para inspeção manual.
- Acrescente a entrada correspondente no `evolucoes-com-gatilho.md` (passo 5).

**Pronto quando:**

- [ ] A seção "Limpeza" cita as três tabelas e aponta para a entrada no `evolucoes-com-gatilho.md`.

### Passo 4: Redis, log e how-tos

**Por quê:** números errados e comportamentos que faltam.

**Faça:**

- `docs/explanation/redis.md:47` e `docs/how-to/agendar-um-job.md:167`: com o Redis fora, a subida da app falha em até cerca de 15 s (5 s esperando a conexão das filas, mais 10 s de timeout do registro dos jobs agendados), não 10 s.
- `docs/explanation/redis.md`, seção "Dois clientes para o mesmo endereço": a subida espera até 5 s pela conexão das filas e segue sem ela, para não devolver 503 do rate limit nas primeiras requisições (`bullmq-connection.ts`).
- `docs/explanation/redis.md`, seção "Jobs agendados": guardam as 20 últimas execuções concluídas e as 100 últimas com falha (`scheduled-job.processor.ts`).
- `docs/explanation/observabilidade.md:37`: o log sai em JSON fora de `development`. Em `development`, passa pelo `pino-pretty`.
- `docs/how-to/publicar-um-evento-de-integracao.md:198`: inclua o `SequentialIdGenerator` (para o `IdGenerator`) entre os fakes dos parâmetros novos.

**Pronto quando:**

- [ ] `git grep -n "10 segundos" -- docs/explanation/redis.md docs/how-to/agendar-um-job.md` só acha frases que falam do timeout de registro, não do tempo total até falhar.
- [ ] Os números citados batem com as constantes dos arquivos.

### Passo 5: evoluções com gatilho

**Por quê:** a tabela deve ser a lista completa do que foi adiado de propósito, mas outras páginas adiam coisas que não estão nela. A entrada dos spans de controller dá a entender que eles foram desligados.

**Faça:** no `docs/reference/evolucoes-com-gatilho.md`:

- Acrescente:
  - **Circuit breaker:** contexto em `servicos-externos.md`, com o gatilho que a página dá.
  - **Duas instâncias de Redis em produção:** contexto em `redis.md`.
  - **Paginação por cursor:** contexto em `paginar-uma-listagem.md`.
  - **Limpeza de `processed_events`, `idempotency_keys` e das linhas mortas da outbox:** gatilho "antes do primeiro deploy em produção, ou quando uma dessas tabelas passar de ~1 milhão de linhas".
- Reescreva a entrada "Reativar os spans de controller": nada os desliga. A instrumentação do Nest vem no `getNodeAutoInstrumentations` e só não age porque aceita Nest abaixo do 12. Quando passar a aceitar o 12, basta atualizar a dependência.
- Cada página de origem aponta para a entrada correspondente.

**Pronto quando:**

- [ ] A tabela tem as quatro entradas novas, cada uma com condição, ação e contexto.
- [ ] `servicos-externos.md`, `redis.md` e `paginar-uma-listagem.md` linkam a entrada que lhes corresponde.
- [ ] `npm run ci` passa (fecha a fase 3).

---

## Fase 4: doc de arquitetura e ADRs

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: exceções de camada e pastas
> - [ ] Passo 2: shared kernel completo
> - [ ] Passo 3: frases de arquitetura
> - [ ] Passo 4: ADRs

### Passo 1: exceções de camada e pastas

**Por quê:** o código quebra regras gerais de propósito, e a doc não registra isso. Quem cria um módulo copiando o padrão acha que as regras não têm exceção.

**Faça:** no `docs/reference/camadas.md` e no `docs/reference/convencoes.md`, registre:

- **`RefreshToken`:** não tem mapper (o repositório usa `toProps()` e `restore()` direto), e o `createdAt` é uma coluna comum que faz parte do domínio, porque entra na conta de expiração.
- **`inventory`:** não tem entidade de domínio. O repositório é organizado por operações (`registerReservation`, `decrease`…), e as invariantes ficam no banco (CHECK, UNIQUE, update condicional), porque o saldo é disputado demais para ler, conferir e gravar. Esta exceção entra ao lado da do `catalog`, no `camadas.md:18`.
- **Raiz de `application/`:** um helper usado por vários casos de uso fica ali (`orders/application/order-access.ts`, `identity/application/session-issuer.ts`).
- **Nest module auxiliar:** um módulo pode ter um segundo Nest module para ligar um port do shared (`identity/infra/identity-auth.module.ts`).
- Os adapters movidos na fase 1, passo 4, já seguem a tabela. Confirme que os exemplos citados usam os caminhos novos.

**Pronto quando:**

- [ ] O `camadas.md` lista o `inventory` ao lado do `catalog` como exceção, com o motivo.
- [ ] O `convencoes.md` registra as duas exceções do `RefreshToken`, junto das regras do mapper e do `createdAt`.
- [ ] A tabela de pastas do `camadas.md` cobre a raiz de `application/` e o Nest module auxiliar.

### Passo 2: shared kernel completo

**Por quê:** o `camadas.md` (linhas 63-65 e 136-137) e o `shared-kernel.md:11` listam só parte do que existe em `src/shared`.

**Faça:** acrescente às duas páginas:

- no domínio: `DomainEvent` e `ConcurrencyError`;
- na aplicação: `IntegrationEvent` e `IdempotentConsumer`;
- os ports `ActorResolver`, `Outbox`, `EventPublisher` e `ProcessedEvents`;
- a pasta `src/shared/testing/` na árvore;
- o fato de os erros do `Money` ficarem dentro de `money.vo.ts`, e não em `domain/errors/`.

**Pronto quando:**

- [ ] Cada classe ou interface exportada de `src/shared/domain` e `src/shared/application` aparece em pelo menos uma das duas páginas. Para conferir: `git grep -hn "^export \(abstract \)\?\(class\|interface\)" -- src/shared/domain src/shared/application`.

### Passo 3: frases de arquitetura

**Por quê:** frases que generalizam demais ou citam o lugar errado.

**Faça:**

- `docs/explanation/arquitetura.md:35`: os casos de uso não têm `@Injectable()` e são criados por `useFactory`. Os adapters podem ter `@Injectable()` e entrar com `useClass`, como os repositórios TypeORM e os facades. Fique coerente com o `camadas.md:98`.
- `docs/explanation/comunicacao-entre-modulos.md:116`: a outbox fica no Postgres (`shared.outbox`). Só as filas que ela alimenta ficam no Redis.
- `docs/reference/convencoes.md:26` e `docs/reference/camadas.md:119`: o `npm run arch` roda `depcruise src` e não olha o `test/`. A fronteira `test` só é conferida no code review, e os e2e importam `../src/app.module.js` de propósito.
- `docs/README.md:100`: o formato `status: accepted`, "Considered Options" e "Consequences" vale para as ADRs novas.

**Pronto quando:**

- [ ] `git grep -n "outbox e as filas do BullMQ já passam pelo Redis" -- docs` não acha nada.
- [ ] As quatro frases descrevem o comportamento citado.

### Passo 4: ADRs

**Por quê:** a 0002 cita o lugar errado da ligação do port, a 0004 aponta para um "passo 18" que não existe, a 0005 tem um título fora do formato e uma frase sobre o `arch` que não vale para o `test/`, e a 0006 descreve skills e regras por camada que não existem.

**Faça:**

- **ADR 0002:** corrija a frase do texto (linhas 7 e 9). O port é ligado no `identity-auth.module.ts`, e o `AppModule` só repassa esse módulo para o `AuthModule.forRoot`. A decisão (ator carregado por requisição) continua a mesma.
- **ADR 0004** (linhas 45 e 47): troque "passo 18 do plano" pelo link para o `evolucoes-com-gatilho.md`, com a nota "atualizado em AAAA-MM-DD" (a data do commit).
- **ADR 0005:** renomeie o título "Consequências" para "Consequences". Na linha 59, diga que o `arch` não confere o `test/`.
- **ADR 0006:** tire do texto só o que não existe: o `.claude/skills/` da linha 7, a regra-ponteiro **por camada** do item 3 (existe uma regra só, `.claude/rules/camadas.md`), o item 4 inteiro das skills-ponteiro e a menção às skills nas linhas 65 e 66. O resto da ADR (Diátaxis, `docs:check`, Markdown fora do Prettier, a doc do módulo nascendo com ele, o teste de roteamento) e os 12 ponteiros para ela ficam como estão.
- **`evolucoes-com-gatilho.md:27`** ("O dono do repositório decidir usar skills"): a coluna de contexto deixa de apontar para a ADR 0006 e passa a dizer que a reversão está registrada ali mesmo.

**Pronto quando:**

- [ ] `git grep -n "\.claude/skills" -- docs/adr` não acha nada.
- [ ] `git grep -n "passo 18" -- docs` não acha nada.
- [ ] `git grep -n "Consequências" -- docs/adr` não acha nada.
- [ ] Os links para a ADR 0006 continuam válidos.
- [ ] `npm run ci` passa (fecha a fase 4).

---

## Fase 5: Redis fora do ar na prática

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: subida sem Redis
> - [ ] Passo 2: Redis caindo com a app no ar

**Cuidado:** use só `docker compose stop redis` e `docker compose start redis`, na raiz deste repo. Nada de `down -v`, nada de `prune`, e nada em containers de outros projetos. Não rode o e2e enquanto a app estiver de pé.

### Passo 1: subida sem Redis

**Por quê:** a fase 3 diz que a subida falha em até cerca de 15 s. Esse número saiu da leitura do código e não foi medido.

**Faça:**

1. `docker compose stop redis`.
2. Suba a app com `npm run start:dev` e meça o tempo até ela falhar. Guarde o log.
3. `docker compose start redis` e espere o healthcheck ficar `healthy`.

**Pronto quando:**

- [ ] O tempo medido e a mensagem de erro estão no **Como ficou** do passo.
- [ ] O `redis.md` e o `agendar-um-job.md` dizem o tempo medido, ou o texto foi corrigido para bater com ele.

### Passo 2: Redis caindo com a app no ar

**Por quê:** pela leitura do código não dá para confirmar se uma `Queue` do BullMQ trava ou rejeita na hora (a conexão usa `enableOfflineQueue: false`), nem se os avisos "redis connection error" e "cache store error" aparecem.

**Faça:**

1. Com o Redis no ar, suba a app e confirme que `GET /health/ready` responde 200.
2. `docker compose stop redis`.
3. Com o token de um usuário do seed:
   - chame `GET /v1/orders`, que passa pelo cache;
   - crie um pedido com `POST /v1/orders`, que grava na outbox;
   - chame `GET /health/ready`.
   Anote o status de cada resposta, quanto ela demorou e o que aparece no log.
4. `docker compose start redis`. Confirme que o `/health/ready` volta a 200 e que o pedido criado no passo 3 sai pela outbox.
5. Encerre a app.

**Pronto quando:**

- [ ] Cada afirmação da seção "Redis fora do ar: cada uso falha do seu jeito" do `redis.md`, e o aviso citado no `cachear-uma-leitura.md`, foi confirmada ou corrigida, com o resultado no **Como ficou**.
- [ ] `docker compose ps` mostra o Postgres e o Redis `healthy`, e nenhuma app ficou de pé.
- [ ] `npm run ci` passa (fecha a fase 5).

---

## Fase 6: entrega

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 1: verificação completa
> - [ ] Passo 2: `/simplify` e `/code-review`
> - [ ] Passo 3: apagar este plano

### Passo 1: verificação completa

**Faça:** rode, nesta ordem, com nenhum `start:dev` de pé: `npm run ci`, `npm run test:int`, `npm run db:setup` e `npm run test:e2e`.

**Pronto quando:**

- [ ] Os quatro comandos passam.
- [ ] O total de testes é o da linha de base mais os casos acrescentados na fase 1 (a linha de base foi 195 unitários, 79 de integração e 55 e2e).

### Passo 2: `/simplify` e `/code-review`

**Por quê:** é o fluxo de entrega do `AGENTS.md`.

**Faça:** rode `/simplify` e depois `/code-review` sobre o diff da branch contra a `main`. Corrija o que for real e rode de novo o passo 1 se o código mudar.

**Pronto quando:**

- [ ] As duas skills rodaram, e cada achado foi corrigido ou descartado com o motivo registrado.

### Passo 3: apagar este plano

**Faça:** apague este arquivo e tire o link dele do `docs/README.md`.

**Pronto quando:**

- [ ] `npm run docs:check` passa sem o arquivo.
- [ ] A branch está pronta para revisão, sem push.
