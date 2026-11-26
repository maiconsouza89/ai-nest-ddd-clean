---
type: how-to
---

# Como remover os módulos de exemplo

Use este guia para tirar do projeto os módulos de exemplo (orders, catalog e inventory, mais o aviso de pedido pago do notifications) e ficar só com a base: o `shared`, o identity e o notifications.

## Pré-requisitos

- Se for usar a paginação, o cache ou a `Idempotency-Key`, copie antes o código do orders que os usa: os how-tos de [paginação](paginar-uma-listagem.md) e de [cache](cachear-uma-leitura.md) seguem esse código, e a `Idempotency-Key` (port, store e tabela) sai junto com o orders. O mesmo vale para os modelos dos how-tos de [serviço externo](integrar-um-servico-externo.md) (o `ResilientPaymentGateway` e o teste dele) e de [rota protegida](proteger-uma-rota.md) (o `order-access.ts`, o `@Roles` do catalog e o `orders.e2e-spec.ts`). Depois de apagar, o código só volta pelo histórico do git.
- Nenhum `start:dev` nem e2e rodando.
- Terminal na raiz do repositório.
- Postgres, Redis e Mailpit no ar, para os testes do fim: `docker compose up -d --wait postgres redis mailpit`.

## Passos

1. Apague as pastas dos três módulos, juntas: o orders chama o catalog e o inventory, e o inventory consome os eventos do orders.

   ```bash
   rm -r src/modules/orders src/modules/catalog src/modules/inventory
   ```

2. No `src/app.module.ts`, tire os imports e as entradas de `CatalogModule`, `InventoryModule` e `OrdersModule` no `imports` do `AppModule`.

3. Apague o aviso de pedido pago do notifications:

   ```bash
   rm src/modules/notifications/infra/events/on-order-paid.handler.ts \
     src/modules/notifications/infra/events/on-order-paid.handler.spec.ts \
     src/modules/notifications/application/use-cases/send-order-paid-email.use-case.ts \
     src/modules/notifications/application/ports/recipient-directory.ts \
     src/modules/notifications/infra/adapters/identity-recipient-directory.ts
   ```

4. No `src/modules/notifications/infra/notifications.module.ts`:
   - Tire o comentário "exemplo removível" e os providers abaixo dele: `RecipientDirectory`, `SendOrderPaidEmailUseCase` e `OnOrderPaidHandler`.
   - Tire os imports que ficaram sem uso: `Logger`, `UserDirectoryFacade`, `RecipientDirectory`, `SendOrderPaidEmailUseCase`, `IdentityRecipientDirectory` e `OnOrderPaidHandler`.
   - Tire o `imports: [IdentityModule]` e o import do `IdentityModule`: só a `UserDirectoryFacade` o exigia, e o notifications passa a só consumir eventos.

5. Tire a variável `ORDER_EXPIRATION_MINUTES`:
   - Em `src/shared/infra/config/env.validation.ts`, o campo e o comentário acima dele.
   - No `.env.example`, a linha e o comentário acima dela.
   - Em `docs/reference/variaveis-de-ambiente.md`, a linha da tabela.
   - No seu `.env`, o mesmo que no `.env.example`, se ele veio de uma cópia antiga. Uma variável que a validação não conhece é ignorada, então deixá-la não quebra nada.

6. No `package.json`, apague os scripts `mig:orders:gen`, `mig:orders:run`, `mig:orders:run:prod`, `mig:catalog:gen`, `mig:catalog:run`, `mig:catalog:run:prod`, `mig:inventory:gen`, `mig:inventory:run`, `mig:inventory:run:prod`, `seed:catalog` e `seed:inventory`. O `db:setup`, o `db:migrate:prod` e o `db:seed` acham os scripts pelo nome e não mudam.

7. Apague os testes, os helpers e os fakes dos exemplos:

   ```bash
   rm test/orders.e2e-spec.ts test/catalog.e2e-spec.ts test/primeiro-pedido.e2e-spec.ts \
     test/helpers/catalog.ts test/helpers/catalog-database.ts \
     test/helpers/inventory-database.ts test/helpers/orders-database.ts \
     test/fakes/fake-idempotency-store.ts test/fakes/fake-payment-gateway.ts \
     test/fakes/fake-price-catalog.ts test/fakes/fake-stock-gateway.ts
   ```

   Os outros testes não importam os exemplos. Alguns testes do `shared` usam `'inventory'` e `'orders.order-paid'` só como texto de exemplo e continuam passando.

8. Apague as páginas de referência dos módulos:

   ```bash
   rm docs/reference/modules/orders.md docs/reference/modules/catalog.md docs/reference/modules/inventory.md
   ```

   No `docs/README.md`, em "Módulos", tire as linhas do orders, do catalog e do inventory e, na linha do notifications, o "pagamento confirmado".

9. Em `docs/reference/modules/notifications.md`, tire o que é do pedido pago:
   - A introdução passa a ser: "E-mails ao usuário disparados por eventos do identity: o código de verificação e as boas-vindas."
   - Em "Linguagem ubíqua", as linhas "Destinatário" e "E-mail de pagamento confirmado".
   - Em "Eventos consumidos", a linha do `orders.order-paid` e o item "No pedido pago". No item dos testes, a frase passa a ser: "O teste do lado do consumidor (`identity-email.handlers.spec.ts`) usa os exemplos versionados dos contratos."
   - Em "Dependências", a tabela de módulos. No lugar dela: "Nenhuma facade: o notifications só consome eventos do identity."
   - Em "Decisões", apague a linha da ADR 0003: o notifications não importa mais o `IdentityModule`. Sem outra decisão na lista, escreva "Nenhuma."

10. Em `docs/reference/modules/identity.md`:
    - Na tabela do módulo Nest, a coluna "Quem importa" do `IdentityModule` passa a ser só `AppModule`.
    - Na linha "Verificar o e-mail" da linguagem ubíqua, apague a frase "'Confirmar' é termo do orders e do notifications, não daqui."
    - A `UserDirectoryFacade` fica sem consumidor. Mantenha-a para o primeiro módulo seu que precisar do e-mail de um usuário, ou apague o contrato, o adapter, o export no `identity.module.ts` e a menção na página.

11. No `AGENTS.md`, seção "Projeto", apague o item "Exemplos removíveis".

12. No `README.md`, apague a seção "Módulos de exemplo" e as menções ao orders, ao catalog e ao inventory.

13. Rode `npm run openapi:generate` e commite o `openapi.json`, que perde as rotas `/v1/orders` e `/v1/products`. No PR, o job `openapi` do CI acusa cada rota removida como quebra do contrato: siga a quebra intencional de [Comandos → CI](../reference/comandos.md#ci), com uma linha por operação removida no `.github/oasdiff/err-ignore.txt`.

14. Se o seu banco local já rodou as migrations dos exemplos, os schemas `orders`, `catalog` e `inventory` continuam lá. Para apagá-los, siga [Como resetar o ambiente local](resetar-o-ambiente-local.md). Num clone novo, não há nada a fazer.

15. Apague o tutorial, que cria um pedido, ou reescreva-o sobre um módulo seu. Para apagar:

    ```bash
    rm docs/tutorials/01-do-clone-ao-primeiro-pedido.md
    ```

    No `docs/README.md`, apague a seção "Tutoriais".

16. Rode `npm run docs:check`. Ele acusa cada link para as páginas apagadas nos passos 8 e 15. Corrija cada um e rode de novo até passar:
    - **Link numa lista que só aponta para a página apagada** (como um "Veja também"): apague a linha.
    - **Link no meio do texto:** troque-o por texto simples, ou aponte-o para a seção equivalente do identity, como [Eventos publicados](../reference/modules/identity.md#eventos-publicados) ou [Schema e migrations](../reference/modules/identity.md#schema-e-migrations).
    - **`docs/reference/camadas.md`:** reescreva, sem os links, os itens do módulo CRUD (o catalog) e do módulo sem entidade (o inventory).
    - **`docs/reference/glossario.md`:** apague as linhas e os termos do orders, do catalog e do inventory, e reescreva "Idempotency key" e "Usuário, ator e cliente" sem o pedido.
    - **`docs/explanation/agregados.md`:** o assunto inteiro é o pedido e o estoque. Apague a página, com a linha do índice, a rota do `AGENTS.md` e os links para ela, ou mantenha-a como leitura, com os links trocados por texto.

17. Ache as menções que sobram, fora das ADRs, que são registros imutáveis:

    ```bash
    grep -rlE "orders|catalog|inventory|Order|Product|pedido|produto|estoque" docs README.md AGENTS.md --exclude-dir=adr
    ```

    Para cada menção, conforme o tipo:
    - **Descrição no índice do `docs/README.md`:** ajuste junto com a página que ela descreve.
    - **Fato dos exemplos que deixa de valer** (o `Money` que "só o orders usa", a tabela `orders.idempotency_keys`, o código `PAYMENT_UNAVAILABLE`): reescreva ou apague a frase.
    - **Rota, arquivo ou código de erro de exemplo numa referência ou num how-to** (`/v1/orders`, `order.entity.spec.ts`, `ORDER_ALREADY_PAID`): troque por um da base, como as rotas de `/v1/auth` e os arquivos do identity.
    - **Código do orders como modelo numa explicação ou num how-to** (evento, job, cache, paginação, variável, fornecedor externo, regra de dono): mantenha enquanto nenhum módulo seu tiver o equivalente, e troque o exemplo quando tiver. A base já tem um evento (`identity.email-verified`), um job (`purge-expired-refresh-tokens`), uma variável (`EMAIL_VERIFICATION_CODE_TTL_SECONDS`) e uma rota que atravessa a outbox (`POST /v1/auth/register`).

## Como verificar

- `npm run ci` passa.
- `npm run test:int` e `npm run test:e2e` passam.
- `grep -rnE "#modules/(orders|catalog|inventory)" src test` não encontra nada.

## Veja também

- [ADR 0008](../adr/0008-projeto-template-com-modulos-de-exemplo.md): o que é base, o que é exemplo e por que os exemplos ficam no repositório.
- [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md): imports explícitos entre módulos.
- [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md): facade, eventos e a dependência numa direção só entre módulos.
- [Como criar um módulo](criar-um-modulo.md): o próximo passo, com um módulo seu.
