# Plano do gatilho para `@nestjs/outbox`, `@nestjs/webhooks` e `@nestjs/http-client` (#16)

A issue #16 pede que os três pacotes oficiais do Nest lançados em 2026-09 e 2026-10 entrem na regra de pré-1.0 de [Versões e exceções](../reference/versoes-e-excecoes.md) e ganhem gatilho em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md), como o `@nestjs/authentication` e o `@nestjs/authorization` já têm. É só documentação: nenhum pacote entra no `package.json` e nenhum código muda.

**Mudança em relação ao texto da issue:** ela diz que a documentação mostra o store de Postgres com o Drizzle. Na consulta de 2026-11-25 (Context7, `docs.nestjs.com/reliability/outbox`), o `PostgresOutboxStore` aceita o TypeORM pelo `fromTypeOrm(dataSource)`. O `outbox.add()` recebe o `EntityManager` da transação, e o store recusa o `dataSource.manager`. O ponto a conferir no gatilho deixa de ser "existe suporte ao TypeORM" e passa a ser "o `currentManager()` do `TransactionContext` serve de transação para o `outbox.add()`". A descrição do PR diz isso.

Tudo entra em **um PR**, na branch `docs/gatilho-dos-pacotes-nest-pre-1-0`. O plano nasce e é apagado no mesmo PR, e o registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

As decisões abaixo foram fechadas antes do plano. Mudar uma delas é decisão do dono do repositório, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Versões citadas | Conferidas no npm em 2026-11-25: `@nestjs/outbox` 0.1.4 (criado em 2026-09-25), `@nestjs/webhooks` 0.0.4 (2026-10-01) e `@nestjs/http-client` 0.0.3 (2026-09-27). Na execução, confira de novo com `npm view <pacote> version time.created` e atualize as linhas se algum mudou |
| Regra de pré-1.0 | O item "Pacotes pré-1.0 sem histórico ficam de fora" de `versoes-e-excecoes.md` passa a citar os cinco pacotes, com versão e mês de lançamento, e a data da consulta |
| Gatilho do `@nestjs/outbox` | Chegar à 1.0. O que conferir: o `currentManager()` como transação do `outbox.add()`, um transport para a fila por consumidor do BullMQ (a documentação mostra o `local` e o `ClientProxyTransport`), o trace que atravessa a outbox e a migração de `shared.outbox` e `shared.processed_events` para o schema `nest_outbox`, com as mensagens pendentes |
| Gatilho do `@nestjs/http-client` | Chegar à 1.0 **e** haver um fornecedor real chamado por HTTP. O `with-timeout.ts` e o `retry.ts` servem também a chamadas que não são HTTP (o SMTP do notifications, o gateway de pagamento simulado), então a troca vale só para o adapter HTTP, e os dois helpers continuam |
| Gatilho do `@nestjs/webhooks` | A issue não propõe linha para ele. O plano registra uma: um módulo precisar enviar ou receber webhooks (por exemplo, o pagamento real confirmar por webhook), com o pacote na 1.0. Ele tem o `@nestjs/outbox` como peer (`^0.0.1 \|\| ^0.1.0`), então a adoção depende da do outbox |
| Tabela | As três linhas entram em "Código e dependências" de `evolucoes-com-gatilho.md`, logo depois da linha do `@nestjs/authentication` |
| Explicações | Sem mudança em `consistencia-e-eventos.md`, `servicos-externos.md` e `observabilidade.md`: a coluna "Contexto" das linhas novas aponta para elas |
| `/simplify` e `/code-review` | Pulados: o PR não toca código, e o fluxo de entrega do `AGENTS.md` vale para implementação. A mensagem final e a descrição do PR dizem isso |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Adotar qualquer um dos três pacotes | Os próprios gatilhos, quando forem atingidos |
| `@nestjs/store-kit`, dependência do outbox e do webhooks | Nenhum: entra junto com eles, sem linha própria |
| Ignorar os três no Dependabot da #13 | Nenhum: o Dependabot só atualiza dependências do `package.json`, e nenhuma das três está lá |

## Referências

- Issue #16: `gh issue view 16`.
- Documentação do Nest, consultada no Context7 em 2026-11-25: Reliability → Outbox (stores, `fromTypeOrm`, transports, inbox), HTTP → Webhooks (opções do módulo, dependência da outbox) e Application → HTTP client (`retry`, `backoff`).
- Código citado nos gatilhos: `src/shared/infra/outbox/`, `src/shared/application/idempotent-consumer.ts`, `src/shared/infra/database/transaction-context.ts`, `src/shared/infra/resilience/with-timeout.ts` e `retry.ts`, `src/modules/orders/infra/gateways/resilient-payment.gateway.ts`, `src/modules/notifications/infra/adapters/smtp-email-sender.ts`.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): `evolucoes-com-gatilho.md` com a #15 (uma linha cada) e `versoes-e-excecoes.md` com a #13 (seções diferentes). A ordem de merge põe a #16 logo depois da #13: faça rebase sobre a `main` antes do PR.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal: data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR e comentário na issue só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Regra de pré-1.0 em `versoes-e-excecoes.md` | ⬜ |
| 3 | Três linhas em `evolucoes-com-gatilho.md` | ⬜ |
| 4 | Verificação, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha D com a branch `docs/gatilho-dos-pacotes-nest-pre-1-0` e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Traga este plano para a branch.
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #16 como 🟡.
4. Commit: `docs(plan): plano do gatilho dos pacotes Nest pré-1.0 (#16)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: regra de pré-1.0

1. Confira as versões: `npm view @nestjs/outbox version time.created`, e o mesmo para `@nestjs/webhooks`, `@nestjs/http-client`, `@nestjs/authentication` e `@nestjs/authorization`.
2. Em `docs/reference/versoes-e-excecoes.md`, seção "Regra", reescreva o item dos pré-1.0. Formato sugerido:

   > Pacotes pré-1.0 sem histórico ficam de fora: `@nestjs/authentication` 0.1.7 e `@nestjs/authorization` 0.1.4 (2026-09), `@nestjs/outbox` 0.1.4 e `@nestjs/http-client` 0.0.3 (2026-09) e `@nestjs/webhooks` 0.0.4 (2026-10), conferidos em 2026-11-25. O gatilho para reavaliar cada um está em Evoluções com gatilho.

   Mantenha o link para `evolucoes-com-gatilho.md` que o item já tem.

3. Commit: `docs(versoes): cita outbox, webhooks e http-client entre os pré-1.0 (#16)`.

### Passo 3: linhas em `evolucoes-com-gatilho.md`

Na tabela "Código e dependências", logo depois da linha do `@nestjs/authentication`, acrescente as três linhas. Texto sugerido, para ajustar ao tom da página:

| Condição | O que fazer | Contexto |
| --- | --- | --- |
| O `@nestjs/outbox` chegar à 1.0 | Reavaliar a troca da outbox própria (`src/shared/infra/outbox/`) e do `IdempotentConsumer` pela outbox e pela inbox do pacote. Conferir: o `currentManager()` como transação do `outbox.add()` pelo `fromTypeOrm` (o store recusa o `dataSource.manager`), um transport que mantenha a fila por consumidor do BullMQ, o trace que atravessa a outbox, e a migração de `shared.outbox` e `shared.processed_events` para o schema `nest_outbox` sem perder mensagem pendente | [Consistência e eventos](../explanation/consistencia-e-eventos.md), [Observabilidade](../explanation/observabilidade.md) |
| O `@nestjs/http-client` chegar à 1.0 e um fornecedor real for chamado por HTTP | Reavaliar o cliente do pacote no adapter desse fornecedor, no lugar do `withTimeout` e do `retry` de `src/shared/infra/resilience/`. Os dois helpers continuam para o que não é HTTP, como o SMTP do notifications | [Serviços externos](../explanation/servicos-externos.md) |
| Um módulo precisar enviar ou receber webhooks, com o `@nestjs/webhooks` na 1.0 | Avaliar o pacote: assinatura no padrão Standard Webhooks, retry e log das entregas, e o `@VerifyWebhook()` na entrada. Ele depende do `@nestjs/outbox`, então vem depois da linha acima | [Serviços externos](../explanation/servicos-externos.md) |

Confira as âncoras citadas. Se a seção da outbox em `consistencia-e-eventos.md` tem âncora própria (a linha da limpeza periódica usa `#o-evento-sai-pela-outbox`), aponte para ela.

Commit: `docs(evolucoes): gatilho para outbox, webhooks e http-client do Nest (#16)`.

### Passo 4: verificação, registro e PR

1. `npm run docs:check` e `npm run ci`. Os dois têm de passar.
2. Com o ok do dono: push e PR com o título `docs: gatilho para @nestjs/outbox, @nestjs/webhooks e @nestjs/http-client (#16)`. A descrição traz a mudança em relação à issue (o `fromTypeOrm`), a linha do webhooks, que a issue não pedia, e o motivo de pular o `/simplify` e o `/code-review`.
3. Com o ok do dono: comentário de registro na issue, com este plano e os mesmos três pontos da descrição.
4. Último commit da branch (`docs(plan): fecha o plano do gatilho dos pacotes Nest pré-1.0 (#16)`):
   - Apague este plano.
   - No roadmap, marque a #16 como ✅, com o número do PR na linha.
   - Na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #16, como os das issues #35 e #18.
   - Rode `npm run docs:check` de novo e faça push.
