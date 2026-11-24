---
type: how-to
---

# Como remover os módulos de exemplo

Use este guia para tirar do projeto os módulos de exemplo (orders, catalog e inventory, mais o aviso de pedido pago do notifications) e ficar só com a base: o `shared`, o identity e o notifications. Os três exemplos saem juntos, porque o orders chama o catalog e o inventory, e o inventory consome os eventos do orders.

O `Idempotency-Key` sai junto: o port, o store e a tabela ficam no orders. O `shared` continua com a paginação e o cache, mas nenhum módulo da base os usa. Os how-tos de [paginação](paginar-uma-listagem.md) e de [cache](cachear-uma-leitura.md) mostram o código do orders. Se for precisar de um desses recursos, guarde o código do orders antes de apagar, ou recupere depois pelo histórico do git.

## Pré-requisitos

- Nenhum `start:dev` nem e2e rodando.
- Terminal na raiz do repositório.
- Postgres, Redis e Mailpit no ar, para os testes do fim: `docker compose up -d --wait postgres redis mailpit`.

## Passos

1. Apague as pastas dos módulos:

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

6. No `package.json`, apague os scripts `mig:orders:gen`, `mig:orders:run`, `mig:catalog:gen`, `mig:catalog:run`, `mig:inventory:gen`, `mig:inventory:run`, `seed:catalog` e `seed:inventory`. O `db:setup` e o `db:seed` acham os scripts pelo nome e não mudam.

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

13. Se o seu banco local já rodou as migrations dos exemplos, os schemas `orders`, `catalog` e `inventory` continuam lá. Para apagá-los, siga [Como resetar o ambiente local](resetar-o-ambiente-local.md). Num clone novo, não há nada a fazer.

## Páginas que continuam citando os exemplos

As páginas com "sim" têm links para as páginas de referência apagadas. As com "não" passam no `docs:check`, mas usam os exemplos como modelo ou citam um fato deles que deixa de valer. As ADRs ficam como estão: são registros imutáveis. Para conferir as menções: `grep -rlE "orders|catalog|inventory|pedido" docs`.

| Página | Falha no `docs:check` | O que fazer |
| --- | --- | --- |
| `tutorials/01-do-clone-ao-primeiro-pedido.md` | não | Apagar e tirar do índice do `docs/README.md`, ou reescrever sobre um módulo seu. O tutorial cria um pedido |
| `docs/README.md` | não | As descrições de `arquitetura.md` e `agregados.md` no índice citam o orders e o inventory. Ajustar junto com o que for feito nessas páginas |
| `explanation/agregados.md` | sim | Apagar, tirando os links em `consistencia-e-eventos.md`, `comunicacao-entre-modulos.md` e `camadas.md`, a linha do índice e a rota do `AGENTS.md`. Ou manter como leitura, trocando os links por texto. O assunto inteiro é o pedido e o estoque |
| `explanation/arquitetura.md` | sim | Manter como leitura e trocar os dois links por texto. O código citado é do orders |
| `explanation/consistencia-e-eventos.md` | sim | Manter e apontar o link para [identity](../reference/modules/identity.md#eventos-publicados). Os exemplos de concorrência são do pedido e do estoque |
| `explanation/persistencia.md` | sim | Manter e trocar o link do catalog por texto |
| `explanation/autenticacao.md` | não | Reescrever o exemplo de regra de dono (`order-access.ts`, `NOT_ORDER_OWNER`) quando houver a primeira regra de dono sua |
| `explanation/observabilidade.md` | não | Trocar o exemplo do trace que atravessa a outbox (`POST /v1/orders/:id/pay`) pelo `POST /v1/auth/register` |
| `explanation/servicos-externos.md` | não | Reescrever com o `SmtpEmailSender` da base. A maior parte da página usa o pagamento simulado do orders (`SimulatedPaymentGateway`, `ResilientPaymentGateway`) |
| `explanation/shared-kernel.md` | não | Reescrever a frase "Só o orders o usa" sobre o `Money`: nenhum módulo da base o usa |
| `how-to/cachear-uma-leitura.md` | sim | Tirar o item do orders em "Veja também". Os passos mostram o código do orders: reescrever quando houver o primeiro cache seu |
| `how-to/paginar-uma-listagem.md` | sim | Tirar o item do orders e do catalog em "Veja também". Os passos mostram o código do orders e do catalog: reescrever quando houver a primeira listagem sua |
| `how-to/criar-um-seed.md` | sim | Apontar o link para [identity](../reference/modules/identity.md#schema-e-migrations) |
| `how-to/adicionar-uma-variavel-de-ambiente.md` | não | Reescrever com uma variável da base, como a `EMAIL_VERIFICATION_CODE_TTL_SECONDS`. O exemplo é a `ORDER_EXPIRATION_MINUTES` |
| `how-to/publicar-um-evento-de-integracao.md` | não | Reescrever com o `identity.email-verified`, que segue os mesmos passos. O exemplo inteiro é o `orders.order-paid` |
| `how-to/agendar-um-job.md` | não | Reescrever com o job de limpeza de refresh tokens do identity. O exemplo é o `expire-pending-orders` |
| `how-to/criar-um-modulo.md` | não | Trocar os exemplos de rota (`orders`, `products`) e a menção ao catalog |
| `how-to/rodar-um-teste-especifico.md` | não | Trocar os exemplos de filtro (`order`, `order-item`) por arquivos da base e recontar |
| `reference/camadas.md` | sim | Reescrever, sem os links, os itens do módulo CRUD (catalog) e do módulo sem entidade (inventory) |
| `reference/convencoes.md` | não | Trocar o exemplo de rota versionada (`/v1/orders`) |
| `reference/evolucoes-com-gatilho.md` | não | Tirar a `orders.idempotency_keys` da linha da limpeza de tabelas |
| `reference/operacao.md` | não | Trocar as tags (`orders`, `products`) e a linha de log de exemplo (`GET /v1/orders`) |
| `reference/testes.md` | não | Trocar os arquivos de exemplo de cada tipo de teste (`order.entity.spec.ts`, `cached-order.queries.int-spec.ts` e outros) por arquivos da base |
| `reference/glossario.md` | sim | Apagar as linhas e os termos do orders, do catalog e do inventory. Reescrever "Idempotency key" e "Usuário, ator e cliente" sem o pedido |

Ficam como leitura, sem mudança: `explanation/comunicacao-entre-modulos.md` (facade e eventos com o orders e o inventory), `explanation/modelagem-do-dominio.md` (dinheiro, erros e exclusão no orders) e `explanation/redis.md` (o cache da listagem e o job de expiração do orders).

## Como verificar

- `npm run typecheck`, `npm run lint`, `npm run arch` e `npm test` passam.
- `npm run test:int` e `npm run test:e2e` passam.
- `grep -rnE "#modules/(orders|catalog|inventory)" src test` não encontra nada.
- `npm run docs:check` falha só nas páginas da tabela acima marcadas com "sim", até elas serem ajustadas.

## Veja também

- [ADR 0008](../adr/0008-projeto-template-com-modulos-de-exemplo.md): o que é base, o que é exemplo e por que os exemplos ficam no repositório.
- [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md): imports explícitos entre módulos.
- [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md): facade, eventos e a dependência numa direção só entre módulos.
- [Como criar um módulo](criar-um-modulo.md): o próximo passo, com um módulo seu.
