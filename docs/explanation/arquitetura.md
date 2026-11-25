---
type: explanation
---

# Arquitetura

Por que o projeto é um monólito modular, por que cada módulo tem camadas e por que o NestJS e o TypeORM ficam só na borda. O que fica em cada camada e em qual pasta está em [Camadas](../reference/camadas.md).

## Contexto

O sistema funciona como um monólito modular. É monólito porque tudo sobe em um único deploy e roda em um processo. É modular só enquanto as fronteiras forem respeitadas na prática: cada módulo é dono dos seus dados, os módulos conversam só por [contratos](../reference/glossario.md#contrato), e regras no CI (`npm run arch`) barram os imports proibidos. Pastas por módulo, sozinhas, não bastam. [Agregados](../reference/glossario.md#agregado) e `AggregateRoot` organizam o código dentro de cada módulo, mas não são o que torna o sistema modular.

Dentro de um módulo com regra de negócio, o código fica em camadas: domain guarda as regras, application orquestra, e a infra liga tudo ao Nest, ao banco e ao HTTP. Os exemplos abaixo vêm do módulo [orders](../reference/modules/orders.md), resumidos.

## Por quê

### As dependências apontam para dentro

Infra depende de application, que depende de domain. O domain não depende de ninguém. Assim as regras de negócio são testadas sem banco, sem Nest e sem HTTP, e trocar uma peça de infra (o banco, o fornecedor de pagamento, a fila) não toca nas regras.

### Nest e TypeORM só na infra

Domain e application são TypeScript puro, sem decorators e sem imports de `@nestjs/*` ou `typeorm`. Duas consequências moldam o código.

O contrato do repositório é uma `abstract class`, não uma `interface`. A interface some em runtime e não serve como token de injeção. A classe abstrata é TypeScript puro e funciona como token sem o domain importar o Nest. A documentação oficial do Nest recomenda esse uso quando o mesmo artefato é contrato e token.

```ts
export abstract class OrderRepository {
  abstract save(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;
  // ...
}
```

O caso de uso não tem `@Injectable()`, então o módulo Nest o cria por `useFactory`. Um adapter pode ter `@Injectable()` e entrar por `useClass`, como os repositórios TypeORM e as facades. O módulo é o único lugar que conhece as implementações e liga cada contrato à sua:

```ts
@Module({
  imports: [CatalogModule, InventoryModule, MessagingModule, TypeOrmModule.forFeature([/* ... */])],
  controllers: [OrdersController],
  providers: [
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    {
      provide: PriceCatalog,
      useFactory: (catalog: CatalogFacade) => new CatalogPriceAdapter(catalog),
      inject: [CatalogFacade],
    },
    {
      provide: CreateOrderUseCase,
      useFactory: (repo: OrderRepository, catalog: PriceCatalog, outbox: Outbox,
        ids: IdGenerator, clock: Clock, tx: TransactionManager) =>
        new CreateOrderUseCase(repo, catalog, outbox, ids, clock, tx),
      inject: [OrderRepository, PriceCatalog, Outbox, IdGenerator, Clock, TransactionManager],
    },
    // ...
  ],
})
export class OrdersModule {}
```

O `inject` entrega as dependências na mesma ordem dos parâmetros da factory.

### A entidade guarda as regras

A entidade decide o que pode acontecer com ela e anota os fatos como [eventos de domínio](../reference/glossario.md#evento-de-domínio):

```ts
export class Order extends AggregateRoot {
  private constructor(
    readonly id: string,
    readonly customerId: string,
    private _items: OrderItem[],
    private _status: OrderStatus,
    readonly version: number, // versão lida do banco, para a concorrência otimista
  ) { super(); }

  static create(id: string, customerId: string) {
    const order = new Order(id, customerId, [], OrderStatus.DRAFT, 0);
    order.addDomainEvent(new OrderCreated(id, customerId));
    return order;
  }

  static restore(p: OrderProps) {
    return new Order(p.id, p.customerId, p.items, p.status, p.version);
  }

  place() {
    if (this._status !== OrderStatus.DRAFT) throw new OrderNotEditableError();
    if (this._items.length === 0) throw new EmptyOrderError();
    this._status = OrderStatus.PLACED;
    this.addDomainEvent(new OrderPlaced(this.id, this.customerId));
  }
  // ...
}
```

`create` aplica as regras de criação e anota o fato. `restore` só reconstrói o estado salvo, para o mapper não repetir validações nem anotar de novo um evento que já aconteceu.

### O caso de uso orquestra

O caso de uso carrega e cria agregados, busca o que precisa de fora por [ports](../reference/glossario.md#port-e-adapter) e salva:

```ts
export class CreateOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,
    private readonly catalog: PriceCatalog, // port: o preço vem do catálogo
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly tx: TransactionManager,
  ) {}

  async execute(input: CreateOrderInput) {
    const order = Order.create(this.ids.next(), input.customerId);
    const prices = await this.catalog.pricesOf(input.items.map((i) => i.productId));

    for (const item of input.items) {
      const price = prices.get(item.productId);
      if (!price) throw new ProductNotFoundError(item.productId);
      order.addItem(item.productId, item.qty, price);
    }

    // pedido e eventos na mesma transação: ou grava os dois, ou nenhum
    await this.tx.run(async () => {
      await this.repo.save(order);
      await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
    });
    return { id: order.id };
  }
}
```

O preço nunca vem do cliente. A requisição traz só `productId` e quantidade, e o caso de uso busca o preço pelo port `PriceCatalog`. O caso de uso não sabe que, do outro lado, está a [facade](../reference/glossario.md#facade) do catalog.

### O controller traduz o HTTP

O DTO HTTP tem `class-validator` e fica na infra. O controller valida o formato, converte para o input simples da application e repassa o [ator](../reference/glossario.md#usuário-ator-e-cliente) como dado:

```ts
@Controller('orders')
export class OrdersController {
  constructor(private readonly createOrder: CreateOrderUseCase /* ... */) {}

  @Post()
  create(@Body() body: CreateOrderRequest, @CurrentUser() actor: Actor) {
    return this.createOrder.execute({ customerId: actor.id, items: body.items });
  }
}
```

No caminho de volta, o domain lança erros próprios, com um `code`. A infra do módulo registra o status HTTP de cada `code`, e um filtro global do `shared` monta a resposta em Problem Details ([Respostas de erro](../reference/respostas-de-erro.md)), assim o domain nunca conhece `HttpException`.

### Cada módulo é dono dos seus dados

Cada módulo tem schema, migrations e contratos próprios. Nada de FK, join ou transação entre módulos. É o que permite mudar o banco de um módulo, ou extraí-lo, sem quebrar os outros. Os detalhes estão em [Comunicação entre módulos](comunicacao-entre-modulos.md).

### Nem todo módulo precisa das camadas

A estrutura completa vale para módulos com regra de negócio. Um cadastro que só valida campos é CRUD direto, como o [catalog](../reference/modules/catalog.md#estrutura), e passa para a estrutura completa quando surgir regra. As fronteiras entre módulos valem do mesmo jeito.

## Alternativas e trade-offs

- **Microsserviços desde o início:** cada módulo com deploy próprio isola de verdade, mas cobra rede, deploy e observabilidade distribuída antes de o domínio pedir. O monólito modular sobe num deploy só e mantém transações simples dentro de cada módulo. O custo é disciplina: sem o `npm run arch`, as fronteiras se desfazem em silêncio. Como as fronteiras existem, extrair um módulo depois muda só a infra ([Extrair um módulo para um serviço](comunicacao-entre-modulos.md#extrair-um-módulo-para-um-serviço)).
- **`@Injectable()` no caso de uso:** o Nest montaria o caso de uso sozinho, e o módulo ficaria curto. Em troca, a application importaria o framework. O caminho escolhido deixa o módulo Nest longo, com cada factory repetindo a lista de parâmetros, e o `tsc` não confere se a ordem do `inject` bate com a dos parâmetros: um erro ali só aparece em runtime.
- **`interface` como contrato:** pediria um token à parte (string ou `Symbol`) e `@Inject(TOKEN)` em quem usa, ou seja, o Nest de volta na application. A `abstract class` é contrato e token ao mesmo tempo.
- **Uma entidade só para o domínio e o TypeORM:** economiza a ORM entity e o mapper, mas põe decorators do TypeORM no domain e amarra o modelo de negócio às tabelas. O projeto separa os dois e paga um mapper por agregado ([Persistência](persistencia.md)).

## Decisões relacionadas

- [ADR 0002: Ator carregado a cada requisição](../adr/0002-ator-carregado-por-requisicao.md): de onde vem o `Actor` que o controller repassa.
- [ADR 0003: Imports explícitos entre módulos, sem `@Global`](../adr/0003-imports-explicitos-entre-modulos.md): como um módulo declara de quem depende.
