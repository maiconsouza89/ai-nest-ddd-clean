# Guia: módulos com DDD e Clean Architecture no NestJS

Nov 20, 2026 · @Maicon Souza da Silva

## Visão geral

Movida para [Arquitetura](../explanation/arquitetura.md): o que torna o sistema um monólito modular, a regra de dependência e o Nest só na infra.

## Estrutura de pastas

Movida para [Camadas](../reference/camadas.md#estrutura-de-pastas).

## Camadas

Movida. As regras de cada camada estão em [Camadas](../reference/camadas.md), e o porquê, com exemplos do orders, em [Arquitetura](../explanation/arquitetura.md).

## Persistência com TypeORM

Movida. O porquê da entidade de domínio separada da ORM entity está em [Persistência](../explanation/persistencia.md), e as regras das ORM entities em [Convenções](../reference/convencoes.md#typeorm).

## Módulos independentes

Cada módulo tem seu próprio schema no Postgres, suas migrations e seus contratos. Nenhum outro módulo acessa esses dados diretamente.

### Schema por módulo

```ts
@Entity({ name: 'orders', schema: 'orders' })
export class OrderOrmEntity { ... }
```

A primeira migration do módulo cria o schema:

```ts
await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS orders`);
```

### Migrations por módulo

Um DataSource por módulo, usado só pela CLI, com tabela de controle própria. Como ele conhece apenas as entidades do módulo, o `migration:generate` não mexe nas tabelas dos outros.

```ts
import { config } from 'dotenv';
import { validateEnv } from '#shared/infra/config/env.validation';

// a CLI não passa pelo Nest: carrega e valida o .env por conta própria
config({ path: ['.env.local', '.env'], quiet: true });
const env = validateEnv(process.env);

export default new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [OrderOrmEntity, OrderItemOrmEntity],
  migrations: [import.meta.dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'orders_migrations',
});
```

O projeto é ESM (`"type": "module"`), então o CLI é o `typeorm-ts-node-esm`, o `__dirname` vira `import.meta.dirname` e todo import relativo termina em `.js`. O data source importa o shared por alias (`#shared/*`), e o `ts-node` só o resolve com a condição `@app/source`, por isso o `NODE_OPTIONS` na frente do script. Detalhes, inclusive dos seeds, no [ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md).

```json
"mig:orders:gen": "NODE_OPTIONS=--conditions=@app/source typeorm-ts-node-esm migration:generate src/modules/orders/infra/database/typeorm/migrations/change -d src/modules/orders/infra/database/typeorm/orders.data-source.ts",
"mig:orders:run": "NODE_OPTIONS=--conditions=@app/source typeorm-ts-node-esm migration:run -d src/modules/orders/infra/database/typeorm/orders.data-source.ts"
```

#### Cuidados com migrations

- `synchronize: false` fora de testes locais. O schema muda só por migration.
- A primeira migration do módulo só faz o `CREATE SCHEMA`. O gerador (`npm run plop module`) já a cria. Sem ele, crie-a vazia com `migration:create`. As outras vêm do `migration:generate`.
- Revise toda migration gerada antes do commit. O generate compara entidades e banco, e pode propor alterações inesperadas.
- Rode as migrations no pipeline de deploy, com `migrationsRun: false` na aplicação.

### Conexão no Nest

| Opção | Como | Quando usar |
| --- | --- | --- |
| Conexão única | `autoLoadEntities: true` e cada módulo usa `forFeature` | Padrão, mais simples |
| Conexão por módulo | `forRootAsync({ name: 'orders' })`, `forFeature([...], 'orders')`, `@InjectRepository(Entity, 'orders')` | Isolamento máximo, permite usuário de banco por módulo |

### Regras de independência

- **Sem FK entre schemas.** Guarde só o ID do outro módulo (`customerId`).
- **Sem join entre módulos.** Use a facade ou uma cópia local atualizada por eventos.
- **Outros módulos só importam de `contracts/`.** A única exceção é o `*.module.ts`, que também importa o módulo Nest do outro para declarar a dependência em `imports` (ver Regras de arquitetura no CI e [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md)).
- **Imports que cruzam fronteira usam alias.** `#shared/*` para o shared kernel, `#modules/<módulo>/contracts/*` para o contrato de outro módulo e `#test/*` nos specs. Dentro do mesmo módulo, o import continua relativo (`../domain/x.js`). O alias não substitui a regra acima: o `dependency-cruiser` a aplica também aos imports por alias ([ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md)).
- **Sem transação entre módulos.** Use eventos com outbox quando precisar de consistência.
- Configurações comuns (conexão, `DataSource` global) ficam em `src/shared/infra/database/`.

**Trade-off:** ganha isolamento e facilidade para extrair um módulo como microsserviço. Perde joins e transações entre módulos e passa a lidar com consistência eventual.

## Itens comuns entre módulos (shared kernel)

O `shared` guarda só blocos técnicos que valem igual para todos os módulos. Conceitos de negócio ficam no módulo dono.

| Vai para `shared` | Não vai para `shared` |
| --- | --- |
| `AggregateRoot`, `DomainError`, `Money`, `Page`, `Actor` | Conceitos de negócio de um módulo (`Customer`, `Product`) |
| Ports: `Clock`, `IdGenerator`, `TransactionManager`, `Logger` | Regras específicas de um módulo |
| Infra: guards de auth, outbox, filas, cache, configuração do banco | Repositórios ou entidades de qualquer módulo |
| Value objects com a mesma regra em todo lugar (hoje, só o `Money`) | Tipos que só parecem iguais, mas têm regras diferentes em cada módulo |

Um value object usado por um módulo só fica nele, mesmo que pareça genérico. O `Email`, por exemplo, está em `identity/domain`, e só sobe para o `shared` quando outro módulo precisar da mesma regra. O exception filter também fica em cada módulo: o `shared` tem a base `DomainError`, e cada módulo mapeia os próprios códigos de erro para status HTTP.

Cada módulo tem a própria visão de um conceito. Para o catálogo, `Product` tem descrição e fotos. Para orders, basta `productId` e o preço da compra.

### Regras do shared

- Mantenha pequeno e estável. Qualquer mudança afeta todos os módulos.
- Siga as mesmas camadas (`shared/domain`, `shared/application`, `shared/infra`).
- O shared nunca importa nada de `modules/`.
- Na dúvida, duplique. Duplicar um tipo simples custa menos que acoplar módulos.
- Dado usado por vários módulos (como o nome do produto) tem um único dono. Os outros consultam pela facade ou mantêm uma cópia local atualizada por eventos.

## Autenticação e ownership

Autenticação (quem é você) fica na infra. Ownership (você pode mexer neste recurso?) é regra de negócio e fica em application ou domain.

### 1. Autenticação na infra

O módulo `identity` é dono dos usuários e emite o JWT. O token leva só o `sub`: nada que possa mudar vai nas claims. Um guard global em `shared/infra/auth` valida o token e, a cada requisição, monta o `Actor` com as roles atuais por meio do port `ActorResolver`. Role removida ou conta apagada valem na requisição seguinte, e não quando o token expirar ([ADR 0002](../adr/0002-ator-carregado-por-requisicao.md)).

O access token vale 15 minutos (`JWT_ACCESS_TTL_SECONDS`, padrão 900), e o login devolve `{ accessToken, expiresIn, refreshToken }`, com `expiresIn` em segundos. Quem define a validade é o `TokenIssuer` do `identity`, que assina e informa o prazo, e não o `JwtConfigModule`: esse módulo do `shared` só fixa o segredo e o algoritmo, que valem tanto para assinar quanto para verificar. Como ele não define validade padrão, o guard recusa token sem `exp`.

**Refresh token rotativo:** o access token curto não pode ser revogado antes de vencer, então a sessão vive no refresh token, que pode.

- É opaco: 32 bytes aleatórios em base64url. O banco (`identity.refresh_tokens`) guarda só o SHA-256 dele. Com essa entropia, um hash rápido basta, e a busca é por índice único.
- O login abre uma família. `POST /v1/auth/refresh` troca o token por um par novo na mesma família. Cada token vence em `REFRESH_TOKEN_TTL_SECONDS` (30 dias), e a família tem um prazo absoluto contado do login, `REFRESH_FAMILY_MAX_AGE_SECONDS` (90 dias), que a renovação não estende.
- Cada token vale uma vez. Um token já usado que reaparece é reuso (`RefreshToken.wasUsed`). Para a corrida, o uso é marcado com `UPDATE ... SET "usedAt" = now WHERE id = $1 AND "usedAt" IS NULL`. Se o update não afetar nenhuma linha, o token já foi trocado antes: duas partes têm o mesmo token, e a família inteira é revogada. O caso de uso devolve o resultado da transação e só lança o 401 depois dela, para a revogação ser confirmada.
- Marcar o uso e gravar o sucessor acontecem na mesma transação. Uma renovação concorrente com o mesmo token espera a linha ser liberada, falha no update e revoga a família já com o sucessor dentro. Consequência: um cliente que dispara duas renovações em paralelo com o mesmo token, ou que repete a renovação porque perdeu a resposta, perde a sessão. É o preço de não ter janela de tolerância.
- Uma revogação (logout ou reuso) concorrente com uma renovação em andamento também pega o sucessor. O `revokeFamily` primeiro trava as linhas da família com `SELECT ... FOR UPDATE`, que espera a renovação terminar, e só depois faz o `UPDATE`, que já enxerga o sucessor. O `markUsed` só marca token não revogado e não vencido, então uma renovação que leu o token antes do logout não emite sucessor.
- `POST /v1/auth/logout` revoga a família do token e responde 204 sempre, mesmo para token desconhecido. As outras sessões do usuário continuam.
- Apagar o usuário apaga as sessões dele (`ON DELETE CASCADE`). Um job diário (`jobs.identity`) apaga os tokens vencidos, em lotes. Cada renovação grava uma linha, então a limpeza segue o prazo de cada token, e não o da família.
- Login e refresh usam o mesmo `SessionIssuer` (`identity/application`), que emite o par e grava o hash.

O port fica no `shared`, e o `identity` o implementa com uma leitura por PK. O `shared` não importa o `identity`: quem liga os dois é o `AppModule`, a raiz de composição. Os outros módulos continuam sem consultar a tabela de usuários.

```ts
// shared/application/actor.ts (tipo puro)
export type Actor = { id: string; roles: string[]; tenantId?: string };

// shared/application/ports/actor-resolver.ts
export abstract class ActorResolver {
  /** O ator atual do usuário, ou null se ele não existir mais (o guard responde 401). */
  abstract resolve(userId: string): Promise<Actor | null>;
}

// app.module.ts: o IdentityAuthModule exporta só o ActorResolver (o IdentityModule continua
// exportando só a facade, ADR 0003); o AuthModule registra os guards
imports: [JwtConfigModule, AuthModule.forRoot({ imports: [IdentityAuthModule] }), ...]

// shared/infra/auth/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext): Actor => ctx.switchToHttp().getRequest().user,
);
```

**Protegido por padrão:** registre o guard com `APP_GUARD`, que permite injeção de dependência, e marque as rotas abertas com `@Public()`. Toda rota nova já nasce protegida.

**Pacote oficial:** a documentação atual do Nest apresenta o `@nestjs/authentication`. Ele registra um guard global, oferece `@Public()` e `@CurrentUser()`, e suporta sessão por cookie ou JWT com refresh token de uso único. O `@nestjs/authorization` completa o par, com um guard que nega por padrão (`@Can()`). Os dois ainda estão na 0.1.x (lançados em 2026-09), então o projeto não os adota: fica o guard próprio com `@nestjs/jwt` até eles chegarem à 1.0 (ver [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md)). Se adotar, o `validate()` do provider fica no módulo `identity`, e o controller continua convertendo o usuário em `Actor` antes de chamar o caso de uso.

### 2. O controller repassa o ator como dado puro

```ts
@Post(':id/pay')
pay(@Param('id') id: string, @CurrentUser() actor: Actor) {
  return this.payOrder.execute({ orderId: id, actor });
}
```

### 3. Ownership no caso de uso

A entidade guarda só o ID do dono, sem FK para o schema de `identity`.

```ts
// domain
isOwnedBy(userId: string) {
  return this.customerId === userId;
}

// application
const order = await this.repo.findById(orderId);
if (!order) throw new OrderNotFoundError();

const isAdmin = actor.roles.includes('admin');
if (!order.isOwnedBy(actor.id) && !isAdmin) throw new NotOrderOwnerError();
```

O exception filter traduz `NotOrderOwnerError` para 403.

### Dicas

- **Roles simples** (só admin acessa a rota): `RolesGuard` na infra.
- **Regras por recurso** (dono, mesma empresa, mesmo time): sempre no caso de uso ou no domínio.
- **Listagens:** filtre na query (`orderQueries.listByCustomer(actor.id, page)`), nunca carregue tudo para filtrar depois.
- **Esconder existência do recurso:** devolva 404 em vez de 403.
- **Dados do dono:** o e-mail vem da `UserDirectoryFacade` (`identity/contracts`, método `emailOf`). Para outros dados, amplie a facade ou mantenha uma cópia local alimentada por um evento. O `identity` ainda não publica eventos, e um `UserRegistered` entraria para isso.
- **Multi-tenant:** o projeto ainda não tem tenant, e o `ActorResolver` não preenche o `tenantId`. Ao adotar, o `identity` guarda o tenant do usuário e o `ActorResolver` o devolve junto com as roles (nunca pelo token). O `tenantId` então vai em toda entidade e toda query.

## Agregados e comunicação entre módulos

OrderItem não é submódulo: é parte do agregado Order. Stock é outro módulo (`inventory`), com regras e ciclo de vida próprios.

**Como decidir:** se muda junto com o pai e as regras dependem dele (total, limite de itens), fica no mesmo agregado. Se tem regras próprias e vive sozinho, vira outro módulo.

**Regras de agregado (Vaughn Vernon):** proteja as invariantes dentro do agregado, mantenha agregados pequenos, referencie outros agregados só por ID e altere um agregado por transação. Entre agregados, use consistência eventual.

### Order e OrderItem (mesmo agregado)

```ts
// o getter `items` devolve uma cópia readonly: só a raiz altera a lista interna
get items(): readonly OrderItem[] {
  return [...this._items];
}

addItem(productId: string, qty: number, unitPrice: Money) {
  if (this._status !== OrderStatus.DRAFT) throw new OrderNotEditableError();
  const existing = this._items.find((i) => i.productId === productId);
  if (existing) existing.increase(qty);
  else this._items.push(new OrderItem(productId, qty, unitPrice));
}

get total() {
  return this._items.reduce((sum, i) => sum.add(i.subtotal), Money.zero());
}
```

- Não existe `OrderItemRepository`. O `OrderRepository` salva pedido e itens juntos, na mesma transação.
- No TypeORM, `@OneToMany` com `cascade: true` na ORM entity. O mapper converte os dois.
- O item guarda só o `productId` e uma cópia do preço no momento da compra.

### Stock via port e gateway

Orders declara o que precisa num port. O adapter na infra de orders chama a facade de `inventory`.

```ts
// orders/application/ports/stock-gateway.ts
export abstract class StockGateway {
  abstract reserve(orderId: string, items: { productId: string; qty: number }[]): Promise<void>;
}

// orders/infra/gateways/inventory-stock.gateway.ts
// traduz o resultado do contrato do inventory para o erro de domínio do orders
export class InventoryStockGateway implements StockGateway {
  constructor(private readonly inventory: InventoryFacade) {}

  async reserve(orderId: string, items: { productId: string; qty: number }[]) {
    const result = await this.inventory.reserve({ referenceId: orderId, items });
    if (!result.ok) throw new InsufficientStockError(result.productId);
  }
}
```

O `orderId` vai como `referenceId` da reserva. Se a chamada for repetida por retry ou timeout, o inventory reconhece a referência e não reserva de novo.

### Síncrono ou por eventos

| Abordagem | Como funciona | Prós | Contras |
| --- | --- | --- | --- |
| Síncrona | Caso de uso chama `stock.reserve()` e depois salva o pedido | Simples, resposta imediata | Se o save falhar, sobra reserva sem pedido; precisa compensação |
| Por eventos (não implementada) | Pedido salvo num estado de espera publica `OrderPlaced`; inventory responde com um evento de reserva feita ou recusada; pedido confirma ou cancela | Robusto, módulos desacoplados | Consistência eventual, mais peças (outbox, handlers) |

**Sugestão:** comece síncrono em sistemas pequenos e migre para eventos quando precisar de resiliência ou de extrair o módulo. Como orders depende só do port `StockGateway`, a troca não afeta domain nem casos de uso.

## Dependências e contratos entre módulos

### Dependência circular

Se orders chama inventory e inventory chama orders, o Nest exige `forwardRef`. Isso é sinal de fronteira errada, não um problema técnico a contornar.

**Regra:** o grafo de imports entre módulos deve ser acíclico. Uma direção pode ser síncrona (facade); a volta é sempre por evento.

```ts
// orders -> inventory: síncrono, via facade
@Module({ imports: [InventoryModule], ... })
export class OrdersModule {}

// inventory -> orders: por evento, sem importar OrdersModule
// só o tipo do contrato: `import type` some na compilação
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

Outras saídas: mover o conceito compartilhado para o módulo certo, ou criar um terceiro módulo que orquestra os dois (saga). A regra `no-circular` do `dependency-cruiser` barra o ciclo no CI (`npm run arch`).

**Como um módulo expõe a facade:** o contrato fica em `contracts/` como classe abstrata, e o módulo Nest exporta só ele.

```ts
// inventory/contracts/inventory.facade.ts (TypeScript puro, só primitivos)
export type ReserveStockResult =
  | { ok: true }
  | { ok: false; reason: 'INSUFFICIENT_STOCK'; productId: string };

export abstract class InventoryFacade {
  // devolve um resultado: o contrato não pode importar o InsufficientStockError do domain
  abstract reserve(cmd: ReserveStockCommand): Promise<ReserveStockResult>;
}

// inventory/infra/inventory.module.ts
@Module({
  providers: [
    /* repositórios e casos de uso do inventory */
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

### Versionamento de eventos e facades

Eventos e facades em `contracts/` são a API pública do módulo. Trate como tal.

```ts
export type OrderPaidV1 = {
  eventId: string;      // único por evento, base da idempotência
  type: 'orders.order-paid';
  version: 1;
  occurredAt: string;   // ISO 8601
  payload: { orderId: string; customerId: string; totalCents: number; currency: string };
};
```

- **Payload só com primitivos.** Nunca exponha a entidade de domínio no evento.
- **Mudança aditiva** (campo novo opcional): mesma versão.
- **Mudança que quebra** (renomear, remover, mudar tipo): publique a v2 junto com a v1 até todos os consumidores migrarem, depois remova a v1.
- **Facades:** adicione métodos novos em vez de mudar assinaturas existentes.

### Versionamento da API HTTP

O Nest tem versionamento nativo. Pela URI, a versão entra no início do caminho (`/v1/orders`). O projeto não tem prefixo global. Se tivesse, a versão viria depois dele.

```ts
// app.setup.ts (configureApp, usado pelo bootstrap e pelos testes e2e)
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

// infra/http/controllers
@Controller({ path: 'orders', version: '1' })
export class OrdersV1Controller { /* ... */ }

@Controller({ path: 'orders', version: '2' })
export class OrdersV2Controller { /* ... */ }
```

- **A versão é assunto da infra.** V1 e v2 têm controllers e DTOs próprios, mas chamam os mesmos casos de uso.
- **Mudança aditiva** (campo novo opcional na resposta): mesma versão.
- **Mudança que quebra:** nova versão, mantendo a anterior até os clientes migrarem. Avise o fim da antiga com antecedência, com os headers `Deprecation` (RFC 9745) e `Sunset` (RFC 8594) nas respostas dela.
- **Rotas técnicas** como `/health` usam `VERSION_NEUTRAL` e ficam sem versão.

## Transações, concorrência e eventos

### Transações sem Nest na application

Um port `TransactionManager` na application e a implementação na infra. O `AsyncLocalStorage` guarda o `EntityManager` da transação, e os repositórios usam ele quando existir.

```ts
// shared/application/ports/transaction-manager.ts
export abstract class TransactionManager {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}

// caso de uso: os eventos de domínio viram eventos de integração e vão para a outbox
await this.tx.run(async () => {
  await this.orders.save(order);
  await publishOrderEvents(order, { outbox: this.outbox, ids: this.ids, clock: this.clock });
});

// shared/infra/database/transaction-context.ts: o txStore é privado do arquivo
const txStore = new AsyncLocalStorage<EntityManager>();
export const currentManager = (ds: DataSource) => txStore.getStore() ?? ds.manager;
export const hasActiveTransaction = () => txStore.getStore() !== undefined;
export const runWithManager = <T>(em: EntityManager, work: () => Promise<T>) =>
  txStore.run(em, work);

// TypeOrmTransactionManager: uma transação já aberta é reaproveitada
run<T>(work: () => Promise<T>): Promise<T> {
  if (hasActiveTransaction()) return work();
  return this.dataSource.transaction((em) => runWithManager(em, work));
}

// no repositório
private get repo() {
  return currentManager(this.dataSource).getRepository(OrderOrmEntity);
}
```

**Alternativa pronta:** o plugin `@nestjs-cls/transactional`, com o adapter `@nestjs-cls/transactional-adapter-typeorm`, faz essa propagação via `AsyncLocalStorage`. Mantenha o port `TransactionManager` na application e use o plugin só na implementação.

**Regra:** uma transação altera um agregado só. Gravar a outbox junto é a exceção, porque ela não é um agregado.

### Concorrência (optimistic locking)

Evita que duas requisições carreguem o mesmo pedido e as duas gravem por cima uma da outra (pagar e cancelar ao mesmo tempo, por exemplo). O update só acontece se a versão não mudou.

```ts
// typeorm-order.repository.ts
async save(order: Order) {
  const next = order.version + 1;
  if (order.version > 0) {
    // só avança se ninguém gravou desde que o pedido foi carregado
    const res = await this.repo.update({ id: order.id, version: order.version }, { version: next });
    if (res.affected === 0) throw new ConcurrencyError(); // o cliente recarrega e tenta de novo
  }
  const row = OrderMapper.toPersistence(order);
  row.version = next;
  await this.repo.save(row);
}
```

**Atenção:** o `@VersionColumn` do TypeORM incrementa a versão, mas o `save()` não bloqueia conflitos sozinho. Por isso o `WHERE version` manual.

Use o mesmo `WHERE version` no repositório de qualquer agregado que possa ser editado em paralelo. Por isso a entidade carrega `version`.

**Limite conhecido:** o repositório do `Order` trata `version === 0` como "pedido novo" e pula a checagem nesse caso. Uma linha que já exista com `version = 0`, por exemplo vinda de uma migração de dados com default 0, fica sem proteção no primeiro save. Pedidos criados pelo `Order.create` não são afetados.

**Para estoque, um update atômico condicional é mais simples:** o banco só debita se houver saldo, sem precisar ler antes.

```ts
// typeorm-stock.repository.ts: as colunas são camelCase, então vão entre aspas no SQL
async decrease(productId: string, qty: number) {
  const res = await this.manager
    .createQueryBuilder()
    .update(StockItemOrmEntity)
    .set({ available: () => '"available" - :qty' })
    .where('"productId" = :productId AND "available" >= :qty', { productId, qty })
    .execute();
  return res.affected === 1;
}

// reserve-stock.use-case.ts: quem decide o erro é a application
if (!(await this.stock.decrease(productId, qty))) throw new InsufficientStockError(productId);
```

### CQRS leve

- **Escrita:** passa pelo agregado e pelo repositório.
- **Leitura:** vai direto ao banco com query builder e devolve DTO pronto, sem montar agregados.

```ts
export abstract class OrderQueries {
  abstract listByCustomer(customerId: string, page: PageRequest): Promise<Page<OrderListItem>>;
}
```

Isso é só separar leitura de escrita no código. CQRS completo, com modelos e bancos separados, adiciona complexidade e só compensa em contextos específicos.

### Eventos de domínio com outbox

A entidade registra o evento, mas não publica.

```ts
export abstract class AggregateRoot {
  private events: DomainEvent[] = [];
  protected addDomainEvent(e: DomainEvent) { this.events.push(e); }
  pullDomainEvents() { const e = this.events; this.events = []; return e; }
}
```

**Por que a entidade não publica direto:** se publicasse e o `save` falhasse em seguida, os outros módulos reagiriam a algo que não foi salvo. Registrando primeiro, o evento só sai se a transação confirmar.

1. O caso de uso salva o agregado e grava os eventos na tabela `outbox`, na mesma transação.
2. Um worker lê a outbox, publica (EventEmitter, BullMQ, RabbitMQ, Kafka) e marca como enviado.
3. Resultado: nunca salva sem publicar, nem publica sem salvar.

#### Worker resiliente

- **Várias instâncias:** busque lotes com `FOR UPDATE SKIP LOCKED`, assim dois workers nunca pegam o mesmo evento. Num select simples, o query builder resolve com `.setLock('pessimistic_write').setOnLocked('skip_locked')`. Aqui, a ordem por agregado exige uma subquery `NOT EXISTS` e um outer join, e o Postgres recusa `FOR UPDATE` do lado anulável de um outer join. Por isso o relay usa SQL com `FOR UPDATE OF o SKIP LOCKED`, que trava só as linhas da outbox.
- **Falhas:** retry com backoff exponencial e contador de tentativas. Depois de N falhas, mova o evento para uma fila de mensagens mortas.
- **Ordem:** publique em ordem de criação por agregado quando o consumidor depender da sequência.
- **Limpeza:** apague ou arquive os eventos já publicados periodicamente.

#### Transporte com filas (BullMQ)

Com um barramento em memória, o relay chama os handlers dentro da própria transação. Um handler lento segura o lote, e a falha de um consumidor devolve o evento para todos. Com o BullMQ, o relay só enfileira, e cada consumidor processa na sua fila.

```text
caso de uso ─tx─▶ outbox (Postgres) ─relay─▶ fila por consumidor (Redis) ─▶ handler
```

- **A outbox continua.** O Redis não participa da transação do Postgres. Enfileirar direto no caso de uso traz de volta o problema que a outbox resolve: evento publicado sem `save`, ou `save` sem evento.
- **Uma fila por consumidor.** O BullMQ não faz fan-out: cada job vai para um worker só. O publicador consulta um registro `tipo do evento → filas` e enfileira uma cópia em cada fila. O registro sai de um decorator nos handlers, lido na subida com o `DiscoveryService` do Nest, então cada módulo declara só os próprios handlers.
- **Duplicatas:** use um `jobId` determinístico (`<eventId>__<consumidor>`; o BullMQ não aceita `:` no id). Adicionar um job com id existente é ignorado, mas só enquanto o job existir: com `removeOnComplete`, use uma idade, e não `true`. A idade está em **segundos** (`{ age: 24 * 3600 }`), e a remoção não é imediata: um job vencido só sai quando outro job da mesma fila termina. O `processed_events` continua obrigatório, porque a entrega segue sendo "pelo menos uma vez".
- **Falhas:** `attempts` com `backoff: { type: 'exponential' }`. Esgotadas as tentativas, o job fica no conjunto `failed` da fila, que faz o papel de fila de mortos do consumidor. O `deadAt` da outbox passa a valer só para o que não conseguiu ser enfileirado.
- **Ordem:** a outbox garante a ordem por agregado até a fila. Dentro dela, um retry com backoff pode inverter eventos, então o consumidor não deve depender da sequência. Se precisar, use concorrência 1 e trate o estado fora de ordem no handler.
- **Trace:** o job carrega o evento com o `traceparent` nos metadados, e o worker abre o span a partir dele.

```ts
@Injectable()
export class BullMqPublisher implements EventPublisher {
  constructor(private readonly subscriptions: EventSubscriptions /* , conexão, logger */) {}

  async publish(event: IntegrationEvent) {
    const results = await Promise.allSettled(
      this.subscriptions.forEvent(event.type).map((consumer) =>
        this.queueFor(consumer.name).add(event.type, event, {
          ...QUEUE_JOB_OPTIONS,
          jobId: `${event.eventId}__${consumer.name}`,
        }),
      ),
    );
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
  }
}
```

O `allSettled` tenta todas as filas mesmo que uma falhe. Se alguma falhar, o relay registra a falha e tenta de novo mais tarde, e as filas que já receberam o job ignoram a repetição pelo `jobId`.

### Idempotência

O outbox entrega “pelo menos uma vez”, então um evento pode chegar duplicado.

O `IdempotentConsumer` (`shared/application`) concentra isso, e cada handler só passa o nome do consumidor e o efeito:

```ts
// shared.processed_events tem PRIMARY KEY ("eventId", "consumer")
handle<E extends IntegrationEvent>(consumer: string, event: E, work: (event: E) => Promise<void>) {
  return this.tx.run(async () => {
    // INSERT ... ON CONFLICT DO NOTHING: só o primeiro consegue inserir
    if (!(await this.processed.tryMark(event.eventId, consumer))) return; // já processado
    await work(event); // mesma transação: se o efeito falhar, a marca é desfeita
  });
}
```

A chave primária resolve a corrida entre duas entregas simultâneas. Checar com `exists` antes de processar não resolve.

No HTTP, o cliente envia o header `Idempotency-Key`, descrito em um draft da IETF que ainda não virou RFC. Guarde a chave com uma impressão digital do corpo, a resposta e um prazo de expiração. Mesma chave e mesmo corpo: devolva a resposta salva. Mesma chave com corpo diferente: rejeite.

## Paginação

Paginação é assunto de leitura: fica nas queries (CQRS leve), não nos repositórios do domínio.

**Tipos puros em `shared/application`:**

```ts
export type PageRequest = { page: number; limit: number };
export type Page<T> = { items: T[]; total: number; page: number; limit: number };
```

**DTO HTTP em `shared/infra/http`:**

```ts
export class PaginationQuery {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
```

Os valores padrão e o `@Type` só funcionam com `ValidationPipe({ transform: true })`.

**Query na infra:**

```ts
async listByCustomer(customerId: string, { page, limit }: PageRequest): Promise<Page<OrderListItem>> {
  const [total, rows] = await Promise.all([
    orders.countBy({ customerId }),
    orders
      .createQueryBuilder('o')
      .leftJoin('o.items', 'i')
      .where('o.customerId = :customerId', { customerId })
      .select('o.id', 'id')
      .addSelect('COUNT(i.productId)', 'itemCount') // ...status, createdAt, total e moeda
      .groupBy('o.id')
      .orderBy('o.createdAt', 'DESC')
      .addOrderBy('o.id', 'DESC') // desempate: sem ele, itens com o mesmo createdAt trocam de página
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<Row>(),
  ]);
  // COUNT e SUM chegam do driver como string
  return { items: rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) })), total, page, limit };
}
```

A lista devolve totais por pedido, então a query agrega os itens com `GROUP BY` e lê com `getRawMany`. Com agregação, use `offset`/`limit`: o `skip`/`take` do TypeORM serve para paginar entidades com relações carregadas.

| Tipo | Como | Quando usar |
| --- | --- | --- |
| Offset | `page` e `limit` | Telas com número de página, listas pequenas ou médias |
| Cursor | `after=<id>` | Listas grandes e scroll infinito; não fica lento nem pula itens. UUID v7 ajuda por ser ordenado por tempo |

**Por que cursor escala melhor:** com offset, o banco ainda percorre as linhas puladas, e inserções entre uma página e outra fazem itens repetirem ou sumirem. A busca por chave (keyset) evita os dois problemas.

```ts
// cursor = createdAt e id do último item da página anterior
qb.where('(o.createdAt, o.id) < (:createdAt, :id)', cursor)
  .orderBy('o.createdAt', 'DESC')
  .addOrderBy('o.id', 'DESC') // desempate estável
  .take(limit);
```

Com UUID v7, o próprio `id` já é ordenado por tempo e pode ser o cursor sozinho.

Sempre limite o valor máximo de `limit`.

## Modelagem do domínio

### Dinheiro

`0.1 + 0.2` dá `0.30000000000000004`. Use um value object em centavos (inteiro).

```ts
export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static fromCents(cents: number, currency = 'BRL') {
    if (!Number.isSafeInteger(cents)) throw new InvalidMoneyError();
    return new Money(cents, currency);
  }
  static zero(currency = 'BRL') { return new Money(0, currency); }

  add(o: Money) {
    this.assertSameCurrency(o);
    return new Money(this.cents + o.cents, this.currency);
  }
  times(qty: number) {
    if (!Number.isInteger(qty)) throw new InvalidMoneyError();
    return new Money(this.cents * qty, this.currency);
  }
  private assertSameCurrency(o: Money) {
    if (o.currency !== this.currency) throw new CurrencyMismatchError();
  }
}
```

Somar moedas diferentes é erro, não conversão implícita.

No banco: `bigint` em centavos ou `numeric(12,2)`.

Para dividir valores (parcelas, rateio), crie um método `allocate` que distribui os centavos que sobram. Dividir e arredondar cada parte faz a soma não fechar.

### IdGenerator e Clock

```ts
export abstract class Clock { abstract now(): Date; }
export abstract class IdGenerator { abstract next(): string; }
```

- Nos testes, `FixedClock` e IDs previsíveis deixam os resultados estáveis.
- UUID v7 é ordenado por tempo, então os índices ficam mais eficientes que com v4. O pacote `uuid` já oferece.

A RFC 9562 (2024), que padronizou o v7, aponta a baixa localidade de índice do v4 como motivo para preferir versões ordenadas por tempo.

### Padrão de erros

| Opção | Vantagem | Desvantagem |
| --- | --- | --- |
| Exceptions | Simples, menos código | Erro não aparece no tipo de retorno |
| Result/Either | Erro explícito no tipo | Código mais verboso |

**Sugestão:** exceptions com uma classe base. O filter de cada módulo mapeia `code` para status HTTP numa tabela só (`STATUS` em `infra/http/filters/domain-error.filter.ts`).

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string; // 'ORDER_ALREADY_PAID'
}
```

### Onde validar

| Tipo | Exemplo | Onde |
| --- | --- | --- |
| Formato | Campo obrigatório, e-mail válido, tamanho máximo | DTO HTTP (`class-validator`) |
| Invariante | Quantidade maior que zero, pedido pago não muda | Entidade ou value object |
| Depende de dados | E-mail único, estoque disponível | Caso de uso (consulta o repositório) |

O domínio valida de novo mesmo que o DTO já tenha validado, porque ele também é chamado por jobs e eventos. Para unicidade, mantenha também uma constraint `UNIQUE` no banco como última barreira.

### Domain services

Para regras que envolvem mais de um agregado e não pertencem a nenhum deles. São classes puras em `domain/services`: recebem dados prontos e não acessam repositório.

```ts
export class DiscountPolicy {
  calculate(order: Order, tier: CustomerTier): Money {
    if (tier === 'GOLD' && order.total.cents >= 50_000) {
      return Money.fromCents(Math.round(order.total.cents * 0.1));
    }
    return Money.zero();
  }
}
```

O caso de uso carrega os dados e chama o serviço. Não abuse: se a regra cabe numa entidade, ela fica na entidade.

### Auditoria e soft delete

- **`createdAt` e `updatedAt`:** detalhe técnico, ficam na ORM entity (`@CreateDateColumn`, `@UpdateDateColumn`). Só vão para o domínio se alguma regra depender deles.
- **Quem fez (`createdBy`, ainda não existe):** o caso de uso já recebe o `Actor` na entrada (o controller o tira de `req.user`) e pode repassá-lo ao repositório. Preencher num subscriber do TypeORM exigiria guardar o ator num contexto por requisição (`AsyncLocalStorage`, por exemplo com `nestjs-cls`), que o projeto ainda não tem. O único `AsyncLocalStorage` hoje é o da transação.
- **Exclusão com significado de negócio** (cancelar, arquivar): modele como estado no domínio (`order.cancel()`), não como `deletedAt`.
- **Soft delete técnico:** `@DeleteDateColumn` e `softDelete()` no repositório. O TypeORM já ignora registros excluídos nas consultas.
- **Histórico completo de mudanças:** tabela de auditoria alimentada pelos eventos de domínio.

## Infra: configuração, jobs, cache e serviços externos

Tudo aqui é porta de entrada ou adaptador. Nenhum deles contém regra de negócio.

### Configuração

O `@nestjs/config` carrega as variáveis de ambiente, valida na subida e as expõe tipadas pelo `ConfigService`.

**1. Registro global, na raiz (`app.module.ts`)**

```ts
ConfigModule.forRoot({
  isGlobal: true,                        // não precisa importar em cada módulo
  cache: true,                           // lê process.env uma vez só
  envFilePath: ['.env.local', '.env'],   // se repetir, vale o primeiro arquivo
  ignoreEnvFile: process.env.NODE_ENV === 'production', // em produção, só variáveis do ambiente
  validate: validateEnv,                 // se falhar, a aplicação não sobe
}),
```

**2. Validação (`shared/infra/config/env.validation.ts`)**

```ts
// com strict: `!` nas obrigatórias, valor padrão nas opcionais
export class EnvironmentVariables {
  @IsEnum(['development', 'test', 'production']) NODE_ENV: string = 'development';
  @IsInt() @Min(1) @Max(65535) PORT: number = 3000;
  @IsString() @IsNotEmpty() DATABASE_URL!: string;
  @IsString() @MinLength(32) JWT_SECRET!: string;
  @IsInt() @Min(1) JWT_ACCESS_TTL_SECONDS: number = 900;
  // ... as demais variáveis do .env.example
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) throw new Error(errors.toString());
  return env;
}
```

**3. Configuração nos módulos:** todas as variáveis ficam na `EnvironmentVariables`. O módulo Nest lê o que precisa no `useFactory` e passa valores simples ao caso de uso, que não conhece o `ConfigService`.

```ts
// orders.module.ts
{
  provide: ExpirePendingOrdersUseCase,
  useFactory: (/* repo, outbox, ... */ config: ConfigService<EnvironmentVariables, true>) =>
    new ExpirePendingOrdersUseCase(/* ... */ {
      maxIdleMs: config.getOrThrow('ORDER_EXPIRATION_MINUTES', { infer: true }) * 60_000,
      batchSize: EXPIRATION_BATCH_SIZE,
    }),
  inject: [/* ... */ ConfigService],
}
```

`ConfigService<EnvironmentVariables, true>` com `{ infer: true }` tipa a chave e o valor: uma chave que não existe na classe não compila. Se a configuração de um módulo crescer, o `@nestjs/config` oferece `registerAs` com `ConfigModule.forFeature` para separá-la por módulo. O projeto ainda não precisou.

#### Cuidados

- Versione um `.env.example` com todas as chaves e sem valores reais. O `.env` fica no `.gitignore`.
- O DataSource da CLI de migrations não passa pelo Nest: ele lê `process.env` direto. Carregue com `dotenv` e reaproveite o mesmo `validateEnv` (ver Migrations por módulo).
- Uma variável renomeada entra na tabela `RENAMED` do `validateEnv`. Se o ambiente ainda define o nome antigo, a subida falha com a mensagem do novo nome, em vez de ignorar o valor sem avisar.

### Jobs, cron e workers

São portas de entrada, como o controller: ficam em `infra/jobs` ou `infra/queues` e só chamam casos de uso.

```ts
@Injectable()
export class ExpirePendingOrdersJob {
  constructor(private readonly expire: ExpirePendingOrdersUseCase) {}

  @Cron('*/5 * * * *')
  run() {
    return this.expire.execute();
  }
}
```

Este projeto usa os Job Schedulers do BullMQ (o `@Cron` acima é só a comparação). O `@nestjs/schedule` roda dentro do processo. Com várias instâncias da aplicação, o `@Cron` dispara em todas. Para rodar uma vez só, use um lock no banco ou os Job Schedulers do BullMQ (`upsertJobScheduler`). A API antiga de repeatable jobs foi descontinuada na v5.16 e removida na v6 do BullMQ.

Com o BullMQ, o agendador vira um job scheduler registrado na subida, e o processor tem o mesmo papel do job com `@Cron`: só chamar o caso de uso.

```ts
// na subida (idempotente: várias instâncias podem chamar)
await queue.upsertJobScheduler('orders.expire-pending-orders', { pattern: '*/5 * * * *' });
await queue.setGlobalConcurrency(1); // uma execução por vez, mesmo com várias instâncias

// o worker só chama o caso de uso
new Worker('jobs.orders', () => expire.execute(), { connection });
```

- No projeto, esse ciclo (agendador, worker, `JOBS_ENABLED`, timeout na subida e parada) fica numa base só, `ScheduledJobProcessor` (`shared/infra/jobs`). Cada processor declara a própria fila e o agendador, e implementa `run()` chamando o caso de uso. A fila é só dele: o Worker roda `run()` para qualquer job da fila, então dois jobs não podem dividir uma. Hoje são dois, um por módulo: a expiração de pedidos (`jobs.orders`) e a limpeza de refresh tokens (`jobs.identity`).
- O projeto usa `Queue` e `Worker` do `bullmq` direto, sem o `@nestjs/bullmq`. O `@Processor`/`WorkerHost` do `@nestjs/bullmq` é uma alternativa para filas declaradas de forma estática.
- Um job do scheduler só é repetido em caso de falha se o template tiver `attempts`. Sem isso, a próxima execução fica para o próximo disparo.

### Redis

Um Redis serve ao cache, às filas (BullMQ) e ao rate limit compartilhado. Só faz sentido quando a aplicação roda em mais de uma instância, ou vai rodar. Em uma instância, cache e throttler em memória bastam, e os jobs podem usar lock no Postgres.

- **Política de memória:** o BullMQ exige `maxmemory-policy noeviction`. Com qualquer outra política, o Redis pode apagar chaves das filas. Um Redis usado como cache normalmente usa `allkeys-lru`. A política vale para a instância inteira, não por database. Em desenvolvimento, uma instância com `noeviction` atende os dois, desde que toda chave de cache tenha TTL. Em produção, prefira instâncias separadas para cache e filas.
- **Persistência:** ligue o AOF (`appendonly yes`) na instância das filas, para não perder jobs num reinício.
- **Clientes:** o BullMQ usa `ioredis` e o `@keyv/redis` usa o cliente `redis`. Os workers exigem `maxRetriesPerRequest: null`. O BullMQ só define esse valor sozinho quando ele mesmo cria a conexão: ao passar uma instância de `ioredis`, defina você. Na conexão de quem só enfileira, `enableOfflineQueue: false` faz o `add` falhar na hora com o Redis fora, em vez de esperar. São conexões diferentes para o mesmo `REDIS_URL`, e tudo bem.
- **Configuração:** `REDIS_URL` validada na subida, como o `DATABASE_URL`.
- **Health:** o `readiness` checa o Redis com `PING`. O `liveness` não depende dele.
- **Testes:** `@testcontainers/redis` sobe um Redis descartável na integração.

O BullMQ 6 também oferece um backend em PostgreSQL. É uma alternativa para ter filas sem operar um Redis, mas o cache continua pedindo um store compartilhado.

### Cache

Um adapter que envolve a implementação de leitura. A application não sabe que existe cache.

O `@nestjs/cache-manager` usa a Keyv como store. Para Redis, use o `@keyv/redis` e sempre escute o evento `error` do store: sem listener, uma queda de conexão derruba o processo.

Com as opções padrão, o listener não basta para a leitura continuar de pé com o Redis fora. O cliente guarda os comandos numa fila até reconectar, e o store lança erro na conexão. Desligue os dois:

```ts
// redis.connection.ts: cliente compartilhado
const client = createClient({
  url: cfg.getOrThrow('REDIS_URL'),
  disableOfflineQueue: true, // Redis fora: falha na hora, sem fila esperando reconexão
  socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3_000) },
});

// cache.module.ts
CacheModule.registerAsync({
  isGlobal: true,
  imports: [RedisModule],
  inject: [RedisConnection, Logger],
  useFactory: (redis: RedisConnection, logger: Logger) => {
    // erro do Redis vira miss (get) ou no-op (set/del), mais um evento 'error'
    const store = createKeyv(redis.client, { throwOnErrors: false, throwOnConnectError: false });
    store.on('error', (err: unknown) => logger.warn({ err }, 'cache store error'));
    return { stores: [store] };
  },
}),
```

```ts
export class CachedOrderQueries implements OrderQueries {
  constructor(private readonly inner: OrderQueries, private readonly cache: Cache) {}

  async listByCustomer(customerId: string, page: PageRequest) {
    const gen = await this.generation(customerId);
    const key = `orders:list:${customerId}:${gen}:${page.limit}:${page.page}`;
    const hit = await this.cache.get<Page<OrderListItem>>(key);
    if (hit) return hit;
    const fresh = await this.inner.listByCustomer(customerId, page);
    await this.cache.set(key, fresh, 60_000);
    return fresh;
  }
}
```

- **Invalidação por evento.** O handler troca a geração do cliente (`orders:list-gen:<customerId>`) e as páginas antigas deixam de ser lidas. A Keyv não apaga por padrão de chave, por isso a geração em vez de `del` em cada página. Toda mudança que aparece na leitura precisa de um evento. Se criar ou fechar um pedido não publica nada, a listagem fica velha até o TTL.
- **TTL em toda chave.** É a rede de segurança se um evento atrasar ou se perder.
- **Consistência eventual.** A invalidação chega quando a outbox entrega o evento. Logo depois de uma escrita, a leitura pode vir desatualizada por esse intervalo.
- **Redis fora não derruba a leitura.** Em erro do cache, registre e leia direto do banco.
- **Cache em memória com várias instâncias não funciona com invalidação por evento.** O evento chega a uma instância só, e as outras continuam servindo dado velho.

Use cache só no lado de leitura, nunca para carregar agregados que serão alterados.

### Serviços externos

Ports na application (`StorageGateway`, `EmailSender`, `PaymentGateway`) e adapters na infra (`S3StorageGateway`, `SesEmailSender`). O adapter traduz os erros do fornecedor para erros próprios. Nos testes, use implementações fake.

#### Resiliência nas chamadas externas

- **Timeout em toda chamada.** Sem ele, uma dependência lenta prende conexões e derruba a aplicação.
- **Retry com backoff só em operações idempotentes.** Repetir uma cobrança sem chave de idempotência pode cobrar duas vezes.
- **Circuit breaker** (por exemplo, `opossum`) para dependências instáveis: depois de várias falhas, ele para de chamar por um tempo e responde rápido com erro.

### Seeds

- **Dados obrigatórios** para o sistema funcionar (categorias padrão, tipos fixos): vão em migration.
- **Dados de desenvolvimento e teste:** seeds por módulo em `infra/database/typeorm/seeds` (no catalog, que não tem camadas, em `database/seeds`), com script próprio (`seed:<módulo>`) e com insert que ignora o que já existe (`ON CONFLICT DO NOTHING`). Assim o seed pode rodar mais de uma vez sem sobrescrever dados editados.

## Qualidade

### Testes por camada

| Camada | Tipo | Como |
| --- | --- | --- |
| Domain | Unitário | Puro, sem mocks |
| Casos de uso | Unitário | Repositórios em memória |
| Repositórios e mappers | Integração | Postgres real com Testcontainers e migrations aplicadas |
| Contratos entre módulos | Contrato | Exemplos versionados de eventos e chamadas da facade, validados por quem publica e por quem consome |
| Fluxos críticos | E2E | Poucos, via HTTP |

```ts
it('não paga duas vezes', () => {
  const order = makeOrder();
  order.pay();
  expect(() => order.pay()).toThrow(OrderAlreadyPaidError);
});
```

O runner é o Vitest, com três projetos no `vitest.config.ts`: `unit` (`*.spec.ts`), `int` (`*.int-spec.ts`) e `e2e` (`test/*.e2e-spec.ts`). A decorator metadata, sem a qual o Nest não injeta por classe, vem do oxc, o transformador padrão do Vite 8, que lê `emitDecoratorMetadata` do `tsconfig.json`. O suporte é parcial: tipos que exigem inferência (type alias, utility types) viram `Object`, então injete sempre por classe ou `@Inject`. Os testes importam `describe`, `it`, `expect` e `vi` de `'vitest'`, sem `globals`. O `src/shared/testing/decorator-metadata.spec.ts` falha se a metadata deixar de ser emitida.

Na integração, o módulo `@testcontainers/postgresql` sobe um Postgres descartável por execução. Rode as migrations reais nele antes dos testes, assim elas também são testadas. Cache e filas usam o `@testcontainers/redis` do mesmo jeito.

### Lint e formatação

Quatro ferramentas, cada uma com uma responsabilidade e nenhuma sobreposta:

| Ferramenta | Responsável por |
| --- | --- |
| `tsc --noEmit` | tipos |
| dependency-cruiser | fronteiras entre módulos e camadas |
| ESLint + `typescript-eslint` | bugs que compilam: promises, `any` inseguro, código morto |
| Prettier | formatação |

O Prettier fica com `singleQuote` e `printWidth: 100`, e a versão é fixada sem `^`, porque até um patch pode mudar a formatação. O ESLint usa `recommendedTypeChecked` com `projectService` (flat config), mais algumas regras do `strictTypeChecked` escolhidas uma a uma (lista na ADR 0004), e o `eslint-config-prettier`, que só desliga as regras de estilo. Não use `consistent-type-imports`: com `emitDecoratorMetadata`, um `import type` numa classe injetada pelo construtor quebra a injeção do Nest em tempo de execução. As fronteiras entre módulos ficam só no dependency-cruiser. Detalhes e regras desligadas: ADR 0004.

`npm run ci` roda typecheck, lint, `format:check`, testes unitários e arch.

### Regras de arquitetura no CI

Com `dependency-cruiser`, rodando `npm run arch` (`depcruise src --output-type err-long`) no pipeline. Se alguém quebrar a regra, o build falha.

As regras ficam no `.dependency-cruiser.js`, e o `comment` de cada uma, impresso junto com a violação, diz o que ela barra. O que nenhuma regra confere está em [Camadas](../reference/camadas.md).

Mantenha `tsPreCompilationDeps: 'specify'`: sem ele, um `import type` de `infra` dentro de `domain` passa despercebido, e com `'specify'` o import só de tipo ganha o rótulo `type-only`, que a `no-circular` usa. Com os aliases `#...`, o `enhancedResolveOptions.conditionNames` precisa incluir `@app/source`. Sem ele, os aliases resolvem para o `dist/`, e as regras deixam de enxergar esses imports sem avisar ([ADR 0005](../adr/0005-aliases-de-import-por-subpath-imports.md)).

A exceção da `modulos-so-via-contracts` é o arquivo do módulo Nest, que importa o módulo Nest do outro para declarar a dependência em `imports`. Os `exports` de um `@Module` são a API pública dele: importar o `CatalogModule` só expõe a `CatalogFacade`. Por isso os módulos de negócio não são `@Global` (só a infraestrutura do `shared` é, ver o [ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md)).

Sem `severity: 'error'`, a violação vira só aviso e o build não falha.

### Observabilidade

- **Tracing distribuído:** OpenTelemetry com auto-instrumentação para Node. Ele propaga o contexto no padrão W3C (`traceparent`) entre serviços e dispensa um correlation id feito à mão.
  - O `main.ts` importa só o `tracing.ts` e depois carrega o app por `import()` dinâmico (`bootstrap.ts`). A auto-instrumentação só enxerga módulos carregados depois dela.
  - No ESM, o `require` não é interceptado. O `tracing.ts` registra o hook `@opentelemetry/instrumentation/hook.mjs` com `module.register` antes de iniciar o SDK. Sem ele, o que o código importa direto (como o `ioredis`) e o `express` ficam sem spans, e nada falha nem avisa. Um `import` estático do app no `main.ts` seria resolvido antes do hook e teria o mesmo efeito. Uma regra de lint (`no-restricted-imports` em `src/main.ts`) barra esse import estático.
  - No Node 26, o `module.register` imprime `DEP0205` na subida. É o caminho que a doc do OpenTelemetry indica hoje; a alternativa é o `register-hooks.mjs` do `import-in-the-middle`, que usa `module.registerHooks`.
  - No Nest 12, não há spans da camada Nest (controllers e handlers): o `@opentelemetry/instrumentation-nestjs-core` só suporta o Nest até a versão 11. Os spans de http, express, pg, ioredis e pino continuam, e isso basta para seguir uma requisição.
- **Logs ligados ao trace:** o id do trace vai em todo log. A outbox copia o `traceparent` (que carrega esse id) para os metadados de cada evento, e o consumidor continua o mesmo trace (`runInEventTrace`). Assim dá para seguir uma requisição por todos os módulos. A instrumentação do pino grava os campos `trace_id` e `span_id`, e não `traceId`. Para mudar o nome, use a opção `logKeys`.
- **Logs estruturados:** JSON com `nestjs-pino`.
- **Na application:** se precisar logar, use um port `Logger`, sem importar o Nest.

## Operação

### Swagger

Decorators do `@nestjs/swagger` só nos DTOs HTTP e controllers. Uma tag por recurso (`@ApiTags('orders')`, `@ApiTags('auth')`). O plugin da CLI do Nest infere boa parte dos tipos e reduz decorators.

Por padrão, o plugin só lê arquivos `.dto.ts` e `.entity.ts`. Como aqui os DTOs HTTP se chamam `*.request.ts`, `*.requests.ts` e `*.query.ts`, configure o `dtoFileNameSuffix` no `nest-cli.json`. Sem isso, essas classes ficam sem schema. O plugin roda só no `nest build`/`nest start`, e não nos testes.

```json
"plugins": [{ "name": "@nestjs/swagger", "options": { "dtoFileNameSuffix": [".request.ts", ".requests.ts", ".query.ts"] } }]
```

### Health, rate limit e segurança básica

| Item | Ferramenta | Observação |
| --- | --- | --- |
| Health check | `@nestjs/terminus` | Separe liveness (processo vivo) de readiness (banco com `pingCheck` e Redis com `PING`). Indicadores próprios usam o `HealthIndicatorService`, porque o Nest 12 removeu a API antiga (`HealthIndicator` e `HealthCheckError`). Marque as rotas de health com `@SkipThrottle()`, senão as sondas do orquestrador contam no rate limit |
| Desligamento gracioso | `app.enableShutdownHooks()` | Termina requisições e jobs em andamento e fecha conexões antes de o processo sair |
| Rate limit | `@nestjs/throttler` | Guard global via `APP_GUARD`, limite mais rígido em login. O storage padrão é em memória: com várias instâncias, use storage compartilhado (Redis), com incremento e expiração atômicos. O `@nest-lab/throttler-storage-redis` 1.2.0 declara suporte só até o Nest 11 (novembro de 2026); no Nest 12, um `ThrottlerStorage` próprio é pequeno. Atrás de proxy, configure `trust proxy` |
| Headers de segurança | `helmet` | `app.use(helmet())` no `configureApp` (`app.setup.ts`) |
| CORS | `app.enableCors()` | Só origens conhecidas |
| Entrada HTTP | `ValidationPipe` global | `whitelist`, `forbidNonWhitelisted` e `transform` ativos |

### Extrair um módulo para microsserviço

Como o módulo já é isolado, a extração muda só a infra:

1. O módulo ganha deploy próprio, e o schema dele vai para um banco separado.
2. Nos módulos que usam a facade, o adapter troca a chamada em memória por um cliente HTTP ou gRPC, implementando o mesmo port.
3. Os eventos passam do barramento em memória para um broker. Com outbox, só muda o publicador.
4. O serviço novo valida o JWT sozinho, com chave compartilhada ou JWKS.

Domain e application não mudam. É o retorno de todo o isolamento feito antes.

## Pragmatismo e checklist

### Nem todo módulo precisa de DDD

Se o módulo só valida campos (categorias, configurações, cadastros simples), use controller, service e repositório TypeORM, ainda dentro da pasta do módulo e respeitando o isolamento. Quando surgir regra de negócio, evolua para a estrutura completa.

### Gerador de módulos

Com Plop, `npx plop module <nome>` cria toda a estrutura padrão com os nomes certos. O `plopfile.mjs` é ESM, e os templates ficam em `plop-templates/module/`. Os templates geram código ESM (imports relativos com `.js`, aliases `#shared/*` e `import.meta.dirname`), e o plopfile cria os scripts `mig:<nome>:*` com `typeorm-ts-node-esm` e a condição `@app/source`.

```js
// plopfile.mjs (resumido)
// [template, destino relativo à pasta do módulo]; os templates são planos, um por arquivo gerado
const FILES = [
  ['entity.hbs', 'domain/entities/{{kebabCase name}}.entity.ts'],
  ['module.hbs', 'infra/{{kebabCase name}}.module.ts'],
  ['migration-schema.hbs', 'infra/database/typeorm/migrations/{{timestamp}}-create-{{kebabCase name}}-schema.ts'],
  // ...
];

export default function (plop) {
  plop.setGenerator('module', {
    prompts: [{ type: 'input', name: 'name', validate: (v) => /* kebab-case */ true }],
    actions: (data) => {
      const kebab = plop.getHelper('kebabCase')(data.name);
      const dir = `src/modules/${kebab}`;
      if (existsSync(dir)) throw new Error(`${dir} já existe`);
      data.timestamp = Date.now(); // o da migration do schema vem antes do da tabela
      return [
        ...FILES.map(([t, dest]) => ({ type: 'add', path: `${dir}/${dest}`, templateFile: `plop-templates/module/${t}` })),
        // + dois `modify` que registram o módulo no app.module.ts, uma checagem de que o registro
        //   casou (o `modify` não avisa) e uma função que grava os scripts mig:<nome> no package.json
      ];
    },
  });
}
```

### Checklist de um módulo novo

#### Arquitetura

- [ ] domain e application sem imports de `@nestjs/*` ou `typeorm`
- [ ] Repositórios e ports como `abstract class`; casos de uso registrados com `useFactory`
- [ ] Comunicação com outros módulos só por `contracts/` (facade e eventos)
- [ ] Grafo de módulos sem ciclos e sem `forwardRef`
- [ ] Nada de negócio no `shared`
- [ ] Regras do `dependency-cruiser` com `severity: 'error'` passando no CI

#### Domínio

- [ ] Entidades com `create` (regras) e `restore` (reconstrução)
- [ ] Validação em três níveis: DTO, entidade e caso de uso
- [ ] Valores monetários com `Money`; preços calculados no servidor, nunca recebidos do cliente
- [ ] Ownership verificado no caso de uso e filtro de dono nas queries
- [ ] Erros de domínio mapeados no exception filter

#### Persistência

- [ ] `@nestjs/typeorm` 12 (Nest 12) com TypeORM 1.x
- [ ] ORM entities separadas, com mapper e `orphanedRowAction: 'delete'` nos filhos
- [ ] Repositórios usando o `EntityManager` da transação ativa
- [ ] Schema próprio, DataSource da CLI, migrations revisadas e `synchronize: false`
- [ ] Nenhuma FK, join ou transação com outros módulos
- [ ] Optimistic locking ou update atômico onde há disputa
- [ ] Listagens paginadas com `limit` máximo

#### Eventos e integração

- [ ] Eventos com `eventId`, `type` e `version`, payload só com primitivos
- [ ] Outbox com `SKIP LOCKED`, retry e fila de mensagens mortas
- [ ] Handlers idempotentes por constraint `UNIQUE`
- [ ] Com filas: outbox antes da fila, uma fila por consumidor e `jobId` determinístico
- [ ] Cache só na leitura, com TTL, invalidação por evento e leitura direta do banco se o cache falhar
- [ ] Chamadas externas com timeout; retry só em operações idempotentes

#### Operação

- [ ] Variáveis de ambiente validadas na subida
- [ ] `.env.example` versionado, `.env` fora do Git
- [ ] Rotas públicas versionadas (`/v1`), com aviso antes de remover versões
- [ ] `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`
- [ ] Guard de autenticação global, `helmet` e rate limit com storage compartilhado
- [ ] Jobs e workers só chamam casos de uso; cron sem duplicar entre instâncias
- [ ] Health check com liveness e readiness, e desligamento gracioso
- [ ] Redis das filas com `maxmemory-policy noeviction` e AOF
- [ ] Testes de domínio, casos de uso, integração e contratos

## Referências

Fontes consultadas na revisão de novembro de 2026.

### Documentação oficial

- [NestJS: Custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS: Circular dependency](https://docs.nestjs.com/fundamentals/circular-dependency)
- [NestJS: Guards](https://docs.nestjs.com/guards)
- [NestJS: Authentication](https://docs.nestjs.com/security/authentication)
- [NestJS: Validation](https://docs.nestjs.com/techniques/validation)
- [NestJS: Configuration](https://docs.nestjs.com/techniques/configuration)
- [NestJS: Versioning](https://docs.nestjs.com/techniques/versioning)
- [NestJS: Database (TypeORM)](https://docs.nestjs.com/techniques/sql)
- [NestJS: Task scheduling](https://docs.nestjs.com/techniques/task-scheduling)
- [NestJS: Health checks (Terminus)](https://docs.nestjs.com/recipes/terminus)
- [NestJS: Rate limiting](https://docs.nestjs.com/security/rate-limiting)
- [TypeORM: Entities](https://typeorm.io/docs/entity/entities)
- [TypeORM: Migrations setup](https://typeorm.io/docs/migrations/setup)
- [TypeORM: Generating migrations](https://typeorm.io/docs/migrations/generating)
- [TypeORM: Upgrading from 0.3 to 1.0](https://typeorm.io/docs/releases/1.0/upgrading-from-0.3/)
- [TypeORM 1.0 is here](https://typeorm.io/blog/typeorm-1-0)
- [nestjs-cls: Transactional plugin](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)
- [nestjs-cls: TypeORM adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/typeorm-adapter)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
- [dependency-cruiser: rules tutorial](https://raw.githubusercontent.com/sverweij/dependency-cruiser/HEAD/doc/rules-tutorial.md)
- [Testcontainers for Node.js: PostgreSQL](https://node.testcontainers.org/modules/postgresql/)
- [Testcontainers for Node.js: Redis](https://node.testcontainers.org/modules/redis/)
- [NestJS: Caching](https://docs.nestjs.com/data/caching)
- [NestJS: Queues](https://docs.nestjs.com/application/queues)
- [NestJS: Migration guide v11 (cache-manager e Keyv)](https://docs.nestjs.com/v11/migration-guide)
- [BullMQ: Job Ids](https://docs.bullmq.io/guide/jobs/job-ids)
- [BullMQ: Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ: Going to production](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ: Job Schedulers](https://docs.bullmq.io/guide/job-schedulers/)
- [BullMQ: Repeatable (legado)](https://docs.bullmq.io/guide/jobs/repeatable)
- [OpenTelemetry JS: Propagation](https://opentelemetry.io/docs/languages/js/propagation/)
- [pg-types (node-postgres)](https://www.npmjs.com/package/pg-types)

### Padrões e especificações

- [Robert C. Martin: The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Vaughn Vernon: Effective Aggregate Design, parte II](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf)
- [Kamil Grzybek: Modular Monolith with DDD](https://github.com/kgrzybek/modular-monolith-with-ddd)
- [Chris Richardson: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox)
- [Martin Fowler: CQRS](https://www.martinfowler.com/bliki/CQRS.html)
- [Martin Fowler: Quantity e Money](https://www.martinfowler.com/eaaDev/Quantity.html)
- [Markus Winand: No offset (keyset pagination)](https://use-the-index-luke.com/no-offset)
- [RFC 9562: UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html)
- [IETF draft: The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
