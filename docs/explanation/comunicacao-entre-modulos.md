---
type: explanation
---

# Comunicação entre módulos

Por que cada módulo é dono dos seus dados, por que a dependência entre dois módulos tem uma direção só e por que os contratos têm versão. As regras estão em [Camadas](../reference/camadas.md#entre-módulos), e como gerar uma migration, em [Como gerar uma migration](../how-to/gerar-uma-migration.md).

## Contexto

Os módulos rodam no mesmo processo e no mesmo Postgres, e nada impede, tecnicamente, que um leia a tabela do outro ou chame a classe do outro. O monólito só continua modular se cada módulo se comportar como se o outro estivesse em outro servidor: dados próprios, conversa só pelo `contracts/` e por eventos ([Arquitetura](arquitetura.md#contexto)).

## Por quê

### Cada módulo tem schema e migrations próprios

Cada módulo tem um schema no Postgres (`orders`, `inventory`, `identity`, `catalog`, e `shared` para a outbox), e as ORM entities dele declaram esse schema (`@Entity({ name: 'orders', schema: 'orders' })`). A primeira migration do módulo só faz o `CREATE SCHEMA`.

As migrations também são por módulo. Cada módulo tem um DataSource usado só pela CLI, com uma tabela de controle própria:

```ts
// DataSource usado só pela CLI de migrations (não passa pelo Nest).
config({ path: ['.env.local', '.env'], quiet: true });
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [OrderOrmEntity, OrderItemOrmEntity, IdempotencyKeyOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'orders_migrations',
});
```

Como o DataSource conhece só as entidades do módulo, o `migration:generate` do orders não enxerga as tabelas do inventory e não propõe mexer nelas. A CLI não passa pelo Nest, então o DataSource carrega e valida o `.env` por conta própria.

Com os dados separados, vêm três proibições, e todas têm o mesmo motivo: cada uma amarraria o schema de um módulo ao do outro.

- **Sem FK entre schemas.** O orders guarda só o id do usuário (`customerId`), sem chave estrangeira para o identity.
- **Sem join entre módulos.** Quem precisa de um dado de outro módulo pede pela facade ou mantém uma cópia local, atualizada por eventos.
- **Sem transação entre módulos.** Quando uma mudança num módulo precisa refletir em outro, ela sai como evento pela [outbox](../reference/glossario.md#outbox), gravada na mesma transação do agregado. A exceção é a reserva de estoque ao fechar o pedido, que entra na transação do orders porque os dois módulos usam a mesma conexão ([Agregados](agregados.md#síncrono-dentro-da-transação-do-pedido)).

### Uma direção síncrona, a volta por evento

Se o orders chama o inventory e o inventory chama o orders, o Nest exige `forwardRef` para montar os dois. O `forwardRef` resolve a montagem, mas o ciclo é sinal de fronteira errada, não um problema técnico a contornar.

Por isso o grafo de dependências entre módulos é acíclico. Uma direção pode ser síncrona, pela [facade](../reference/glossario.md#facade). A volta é sempre por evento. O orders importa o `InventoryModule` para reservar estoque ao fechar o pedido. Quando o pedido é cancelado, o inventory devolve o estoque reagindo ao evento, sem importar nada do orders além do tipo do contrato:

```ts
// só o tipo do contrato: o inventory nunca importa o módulo de orders
import type { OrderCancelledV1 } from '#modules/orders/contracts/events/order-cancelled.event';

@Injectable()
export class OnOrderCancelledHandler {
  constructor(
    private readonly consumer: IdempotentConsumer,
    private readonly releaseStock: ReleaseStockUseCase,
  ) {}

  @IntegrationEventHandler({
    events: ['orders.order-cancelled'],
    consumer: 'inventory.release-on-order-cancelled',
  })
  handle(event: OrderCancelledV1) {
    return this.consumer.handle('inventory.release-on-order-cancelled', event, (e) =>
      this.releaseStock.execute({ referenceId: e.payload.orderId }),
    );
  }
}
```

Quando um ciclo aparece, há outras saídas além do evento: mover o conceito compartilhado para o módulo certo, ou criar um terceiro módulo que orquestra os dois (saga). A regra `no-circular` do `npm run arch` barra o ciclo de imports.

### A facade devolve um resultado, não um erro

A facade é uma `abstract class` em `contracts/`, só com tipos primitivos. O módulo Nest exporta só ela:

```ts
// inventory/contracts/inventory.facade.ts
export type ReserveStockResult =
  { ok: true } | { ok: false; reason: 'INSUFFICIENT_STOCK'; productId: string };

export abstract class InventoryFacade {
  abstract reserve(cmd: ReserveStockCommand): Promise<ReserveStockResult>;
}

// inventory/infra/inventory.module.ts
@Module({
  providers: [
    // ...
    {
      provide: InventoryFacade,
      useFactory: (reserve: ReserveStockUseCase) => new InventoryFacadeImpl(reserve),
      inject: [ReserveStockUseCase],
    },
  ],
  exports: [InventoryFacade], // nada além da facade sai do módulo
})
export class InventoryModule {}
```

A falta de estoque volta como `{ ok: false, reason }`, e não como o `InsufficientStockError` do domain do inventory. O contrato não pode importar o domain do próprio módulo, e quem chama não pode importar o domain de outro. Do lado do orders, um adapter traduz o resultado para um erro do orders.

### Contratos são API pública e têm versão

Eventos e facades em `contracts/` são a API pública do módulo, e os eventos levam a versão no nome do tipo (`OrderPaidV1`) e no campo `version`. Num deploy só, parece desnecessário: quem publica e quem consome mudam juntos. Mas um evento gravado na outbox ou parado na fila antes do deploy é consumido depois dele, pelo código novo. Se o formato mudou sem versão nova, o consumidor lê um evento velho como se fosse novo. Publicar a v2 junto com a v1 até todos os consumidores migrarem evita isso. O mesmo vale, com mais razão, se um módulo virar um serviço à parte.

O payload só tem primitivos pelo mesmo motivo: uma entidade de domínio no evento faria qualquer mudança interna do módulo virar mudança de contrato.

### Extrair um módulo para um serviço

As fronteiras também servem para que um módulo possa sair do processo sem mexer no domain nem nos casos de uso. A extração muda a infra em quatro pontos, e dois deles custam mais do que parece:

- **Dados:** como cada módulo já tem schema e migrations próprios, o schema vai para um banco separado sem desfazer FK nem join. O que se perde é a transação compartilhada. Se o inventory sair, fechar o pedido deixa de reservar o estoque na mesma transação, e o `Order` passa a precisar de um estado de espera e de eventos de volta ([Agregados](agregados.md#síncrono-dentro-da-transação-do-pedido)).
- **Facade:** quem chama outro módulo já passa por um port próprio: `StockGateway` e `PriceCatalog` no orders, `RecipientDirectory` no notifications. Só o adapter troca a chamada em memória por um cliente HTTP ou gRPC. Com a rede no meio, o adapter passa a tratar timeout e erro de conexão como qualquer fornecedor ([Serviços externos](servicos-externos.md)).
- **Eventos:** a outbox e as filas do BullMQ já passam pelo Redis, não pela memória. O que fica preso ao processo é a lista de consumidores: o `EventSubscriptions` descobre quem assina cada evento varrendo os `@IntegrationEventHandler` da própria app, e o relay enfileira só para eles. Um consumidor que vai para outro serviço some dessa varredura, e a fila dele para de receber eventos sem erro. A extração pede uma lista de assinaturas fora do código ou um broker com tópicos, em que cada serviço assina o que consome.
- **Autenticação:** o serviço novo valida o JWT sozinho, com o mesmo segredo ou com uma chave pública. Mas o token só leva o `sub`, e o ator vem do `ActorResolver`, que lê o usuário no schema do identity a cada requisição ([ADR 0002](../adr/0002-ator-carregado-por-requisicao.md)). O serviço novo precisa de outro `ActorResolver`, que pergunte ao identity. Pôr as roles no token evita a chamada, mas traz de volta a opção que o ADR descartou: uma role removida só deixa de valer quando o token vence.

## Alternativas e trade-offs

- **FK e joins entre schemas:** o banco garantiria a integridade, e uma listagem com dados de dois módulos sairia numa query. Em troca, mudar a tabela de um módulo quebraria o outro, e extrair um módulo exigiria desfazer as FKs. O projeto aceita perder joins e transações entre módulos e lidar com consistência eventual. Ganha isolamento e a possibilidade de extrair um módulo depois.
- **`forwardRef` para aceitar o ciclo:** funciona, mas esconde a fronteira errada, e os dois módulos passam a ser um só na prática. O `npm run arch` barra o ciclo.
- **Uma conexão por módulo:** `forRootAsync({ name: 'orders' })`, `forFeature([...], 'orders')` e `@InjectRepository(Entity, 'orders')`. Permite um usuário de banco por módulo, com permissão só no próprio schema, que é o isolamento máximo. O projeto usa uma conexão só (`autoLoadEntities: true`, e cada módulo registra as suas entidades com `forFeature`), que é mais simples. O schema por módulo e as regras de import mantêm a separação, e trocar para conexões separadas depois mexe só na infra.

## Decisões relacionadas

- [ADR 0003: Imports explícitos entre módulos, sem `@Global`](../adr/0003-imports-explicitos-entre-modulos.md): como um módulo declara de quem depende, e por que só a infraestrutura do `shared` é global.
