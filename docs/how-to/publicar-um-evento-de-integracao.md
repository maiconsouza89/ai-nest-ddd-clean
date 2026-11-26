---
type: how-to
---

# Como publicar e consumir um evento de integração

Use este guia quando um agregado precisa avisar outros módulos de um fato, como o `orders.order-paid`, e quando um módulo precisa reagir a esse aviso, como o notifications.

## Pré-requisitos

- O agregado estende `AggregateRoot` (`#shared/domain/aggregate-root`), como a entidade que o `plop module` gera.
- A migration do shared aplicada, com a tabela `shared.outbox`: `npm run mig:outbox:run` ([Comandos](../reference/comandos.md#migrations)).
- Um nome para o evento, no formato `<módulo>.<fato no passado>` (`orders.order-paid`), e o payload dele, só com primitivos.

## Passos

### Publicar

1. Crie o evento de domínio em `domain/events/<nome>.event.ts`:

   ```ts
   import { DomainEvent } from '#shared/domain/domain-event';

   export class OrderPaid implements DomainEvent {
     readonly type = 'OrderPaid';
     constructor(
       readonly orderId: string,
       readonly customerId: string,
       readonly totalCents: number,
       readonly currency: string,
     ) {}
   }
   ```

2. No método de negócio do agregado, depois de mudar o estado, anote o evento:

   ```ts
   // order.entity.ts, em pay()
   this._status = OrderStatus.PAID;
   this.addDomainEvent(
     new OrderPaid(this.id, this.customerId, this.total.cents, this.total.currency),
   );
   ```

3. Crie o contrato em `contracts/events/<nome>.event.ts`. O tipo leva a versão no nome e no campo `version`:

   ```ts
   export type OrderPaidV1 = {
     eventId: string;
     type: 'orders.order-paid';
     version: 1;
     occurredAt: string;
     payload: { orderId: string; customerId: string; totalCents: number; currency: string };
   };
   ```

4. Crie o exemplo versionado em `contracts/events/<nome>.v1.example.ts`, um objeto `OrderPaidV1` com valores plausíveis. O teste de quem publica e o de quem consome usam o mesmo exemplo.

5. Converta o evento de domínio no contrato, em `application/events/`:
   - **Num módulo que já publica eventos:** em `to-integration-event.ts`, acrescente um `if (event instanceof OrderPaid)` que devolve o `OrderPaidV1` e inclua o tipo no retorno da função.
   - **Num módulo que ainda não publica eventos**, crie os dois arquivos:
     - `to-integration-event.ts`, com a função `toIntegrationEvent(event, { eventId, occurredAt })`. Ela tem um `if (event instanceof <Evento>)` por evento, que devolve o contrato com `eventId`, `version`, `occurredAt` em ISO, `type` e `payload`, e lança um erro para o evento sem contrato.
     - `publish-<módulo>-events.ts`, com a função `publish<Agregado>Events(agregado, { outbox, ids, clock })`. Ela tira os eventos do agregado com `pullDomainEvents()`, converte cada um com um `ids.next()` e o `clock.now()`, e grava todos com `outbox.add(<id do agregado>, eventos)`.

6. No caso de uso, salve o agregado e grave os eventos na mesma transação:

   ```ts
   await this.tx.run(async () => {
     await this.repo.save(order);
     await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
   });
   ```

   O caso de uso recebe `Outbox`, `IdGenerator`, `Clock` e `TransactionManager` no construtor. No módulo Nest, acrescente os quatro ao `useFactory` e ao `inject`, na ordem dos parâmetros. `Outbox`, `Clock` e `TransactionManager` vêm de módulos globais do shared. O `IdGenerator` é um provider de cada módulo (`{ provide: IdGenerator, useClass: UuidV7Generator }`), que o `plop module` já gera.

7. No teste unitário do caso de uso, passe os fakes de `#test/fakes` para os parâmetros novos (`FakeOutbox`, `SequentialIdGenerator` para o `IdGenerator`, `FixedClock` e `FakeTransactionManager`) e confira o evento gravado em `outbox.events`. O `create-order.use-case.spec.ts` é o modelo.

8. No teste de contrato do publicador (`application/events/to-integration-event.contract.spec.ts`), acrescente um caso que gera o evento a partir do agregado e o compara com o exemplo pelo `incompatibilities` de `#test/helpers/contract`. Copie um dos casos do orders.

9. Acrescente o evento à tabela "Eventos publicados" em `docs/reference/modules/<módulo>.md`.

### Consumir

1. Crie o handler em `infra/events/on-<fato>.handler.ts` do módulo consumidor. Importe só o tipo do contrato, com `import type`, e passe o efeito pelo `IdempotentConsumer`:

   ```ts
   import { Injectable } from '@nestjs/common';
   import { IdempotentConsumer } from '#shared/application/idempotent-consumer';
   import { IntegrationEventHandler } from '#shared/infra/messaging/integration-event-handler.decorator';
   // só o tipo do contrato: o notifications nunca importa o módulo de orders
   import type { OrderPaidV1 } from '#modules/orders/contracts/events/order-paid.event';
   import { SendOrderPaidEmailUseCase } from '../../application/use-cases/send-order-paid-email.use-case.js';

   @Injectable()
   export class OnOrderPaidHandler {
     constructor(
       private readonly consumer: IdempotentConsumer,
       private readonly sendEmail: SendOrderPaidEmailUseCase,
     ) {}

     @IntegrationEventHandler({
       events: ['orders.order-paid'],
       consumer: 'notifications.email-on-order-paid',
     })
     handle(event: OrderPaidV1) {
       return this.consumer.handle('notifications.email-on-order-paid', event, (e) =>
         this.sendEmail.execute(e.payload),
       );
     }
   }
   ```

   Dê ao consumidor um nome `<módulo consumidor>.<efeito>`, único na aplicação, igual no decorator e no `handle`, e não o renomeie depois de publicado ([Outbox e filas](../reference/outbox-e-filas.md)). Um efeito que pode se repetir sem dano, como descartar um cache, pode dispensar o `IdempotentConsumer`.

2. Ponha o handler nos `providers` do módulo consumidor. A subida o encontra pelo decorator e cria a fila e o worker dele.

3. Escreva o teste do handler com o exemplo do contrato, inclusive a entrega repetida. O modelo é o `on-order-paid.handler.spec.ts` do notifications.

4. Acrescente o evento à tabela "Eventos consumidos" da doc do módulo consumidor e o consumidor à coluna "Consumido por" da doc do publicador.

## Como verificar

- `npm test -- to-integration-event` e `npm test -- <nome do handler>` passam.
- `npm run arch` passa. Ele barra o consumidor que importa do publicador algo além do `contracts/`.
- Com a aplicação no ar (`npm run start:dev`, com `OUTBOX_WORKER_ENABLED` e `QUEUE_WORKERS_ENABLED` em `true`, o padrão), faça a ação que dispara o evento. A linha aparece na outbox e ganha `publishedAt` em cerca de um segundo:

  ```bash
  docker compose exec postgres psql -U postgres -d app \
    -c "SELECT type, attempts, \"lastError\", \"publishedAt\" FROM shared.outbox ORDER BY seq DESC LIMIT 5"
  ```

  No log, `delivering event` é o relay enfileirando, e `processing event` com o nome do consumidor é o handler rodando.

- Para o fluxo inteiro, do HTTP ao handler, o `test/outbox.e2e-spec.ts` é o modelo de teste e2e (`npm run test:e2e -- outbox`).

## Veja também

- [Entrega de eventos](../explanation/entrega-de-eventos.md): por que a outbox, a fila por consumidor e o consumidor idempotente.
- [Outbox e filas](../reference/outbox-e-filas.md): a fila e a marca de entrega que o nome do consumidor determina.
- [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md#contratos-são-api-pública-e-têm-versão): quando um contrato muda de versão.
- [Camadas](../reference/camadas.md): onde fica cada peça e as regras dos contratos de evento.
- [Glossário](../reference/glossario.md#evento-de-integração): evento de domínio, evento de integração, consumidor e outbox.
