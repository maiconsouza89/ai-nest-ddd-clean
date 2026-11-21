# Passo a passo: construindo o projeto do zero

Este roteiro monta, em etapas, o monólito modular descrito em [Guia: módulos com DDD e Clean Architecture no NestJS](research/modules-ddd-clean-nest.md), chamado aqui de **guia de referência**. A primeira etapa é TypeScript puro, e cada peça nova só entra quando o projeto precisa dela.

## Como usar

- Cada passo tem três partes. **Por quê** diz qual necessidade motiva a mudança, **Faça** diz o que muda e **Pronto quando** diz o critério para seguir adiante.
- Só avance com typecheck, testes e regras de arquitetura passando.
- O código completo de cada conceito está no guia de referência. Este roteiro mostra só o que é novo ou o que muda.
- O progresso fica registrado no próprio arquivo, em três lugares: a coluna **Status** do mapa, o **Progresso geral** logo abaixo dele e o bloco de status no início de cada fase.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída.
- Ao começar uma fase, marque 🟡 e preencha **Início** com a data. Marque cada passo (`- [x]`) quando o **Pronto quando** dele for atendido.
- A fase fica ✅ só com todos os passos marcados. Nesse momento, preencha **Conclusão** e atualize o mapa e o progresso geral.
- O passo 39 é uma lista de consulta. Marque-o depois de revisar a lista; não é preciso adotar todos os itens.
- Domínio de exemplo: pedidos (`orders`), catálogo (`catalog`), estoque (`inventory`) e usuários (`identity`).

## Mapa da evolução

| Fase | O que entra | Dependências novas | Status |
| --- | --- | --- | --- |
| 1. Domínio puro | Entidades, value objects, erros e testes | `typescript`, `jest` | ✅ |
| 2. Casos de uso | Ports, repositório em memória e ownership | nenhuma | 🟡 |
| 3. Fronteiras automáticas | Regras de camada no CI | `dependency-cruiser` | ⬜ |
| 4. NestJS | HTTP, módulo, validação e erros convertidos para HTTP | `@nestjs/*`, `class-validator` | ⬜ |
| 5. Configuração e banco | Variáveis de ambiente validadas, Postgres, TypeORM e migrations | `@nestjs/config`, `typeorm`, `pg` | ⬜ |
| 6. Leitura | Queries e paginação | nenhuma | ⬜ |
| 7. Autenticação | Módulo `identity`, JWT e guard global | `@nestjs/jwt`, biblioteca de hash | ⬜ |
| 8. Consistência no módulo | Transações e optimistic locking | nenhuma | ⬜ |
| 9. Vários módulos | Facades e ports entre módulos | nenhuma | ⬜ |
| 10. Eventos | Eventos de domínio, outbox e idempotência | `@nestjs/event-emitter` | ⬜ |
| 11. Produção | Segurança, health check, logs, docs, jobs e cache | `helmet`, `terminus`, `throttler`, `pino`, OTel | ⬜ |
| 12. Escala | Gerador de módulos e evoluções sob demanda | `plop` | ⬜ |

**Progresso geral:** 1 de 12 fases concluídas · 4 de 39 passos concluídos · **Fase atual:** 2

As fases 1 a 3 não usam framework nenhum. Com o domínio funcionando e testado sem o Nest, o Nest passa a ser só um detalhe de entrega.

---

## Fase 1: domínio em TypeScript puro

> **Status:** ✅ Concluída · **Início:** 2026-11-21 · **Conclusão:** 2026-11-21
>
> - [x] Passo 1: projeto TypeScript mínimo
> - [x] Passo 2: primeiros blocos do shared (`DomainError` e `Money`)
> - [x] Passo 3: o agregado `Order`

### Passo 1: projeto TypeScript mínimo

**Por quê:** as regras de negócio são o centro do sistema. Sem framework no começo, elas nascem sem depender dele.

**Faça:**

```bash
git init
npm init -y
npm i -D typescript @types/node jest ts-jest @types/jest
npx ts-jest config:init
```

Use Node 20 ou superior, que o TypeORM 1.x vai exigir mais adiante. O Jest foi escolhido por ser o padrão do Nest e porque o `ts-jest` respeita os metadados de decorators que o Nest usa depois.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "outDir": "dist",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "test"]
}
```

Sem `"type": "module"` no `package.json`, a saída é CommonJS, que é o formato usado pelo Nest e pela CLI do TypeORM.

`package.json`:

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "jest"
}
```

`.gitignore` com `node_modules`, `dist` e `.env`.

```
src/
├── modules/orders/domain/
└── shared/domain/
test/
└── fakes/
```

**Pronto quando:** `npm run typecheck` e `npm test` rodam sem erro.

### Passo 2: primeiros blocos do shared (`DomainError` e `Money`)

**Por quê:** pedido tem preço e total. Para isso o projeto precisa de dinheiro sem erro de ponto flutuante e de erros de domínio identificáveis por código.

**Faça:**

- `shared/domain/domain-error.ts`:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
  }
}
```

- `shared/domain/money.vo.ts`: copie o `Money` do guia de referência ([Modelagem do domínio](research/modules-ddd-clean-nest.md#modelagem-do-domínio)). O valor fica em centavos inteiros, e somar moedas diferentes é erro.
- Testes: soma, `times` com quantidade não inteira e soma de moedas diferentes.

Só entra no `shared` o que vale do mesmo jeito para todos os módulos. `Money` atende a esse critério.

**Pronto quando:** os testes do `Money` passam.

### Passo 3: o agregado `Order`

**Por quê:** as regras do pedido (só edita em rascunho, não fecha vazio, não paga duas vezes) precisam morar num lugar só e ser testáveis sem banco.

**Faça:**

```ts
// domain/value-objects/order-status.vo.ts
export const OrderStatus = { DRAFT: 'DRAFT', PLACED: 'PLACED', PAID: 'PAID' } as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
```

```ts
// domain/entities/order-item.entity.ts
export class OrderItem {
  constructor(readonly productId: string, private _qty: number, readonly unitPrice: Money) {
    if (!Number.isInteger(_qty) || _qty <= 0) throw new InvalidQuantityError();
  }
  get qty() { return this._qty; }
  get subtotal() { return this.unitPrice.times(this._qty); }
  increase(qty: number) {
    if (!Number.isInteger(qty) || qty <= 0) throw new InvalidQuantityError();
    this._qty += qty;
  }
}
```

```ts
// domain/entities/order.entity.ts
export type OrderProps = { id: string; customerId: string; items: OrderItem[]; status: OrderStatus };

export class Order {
  private constructor(
    readonly id: string,
    readonly customerId: string,
    private _items: OrderItem[],
    private _status: OrderStatus,
  ) {}

  static create(id: string, customerId: string) {
    return new Order(id, customerId, [], OrderStatus.DRAFT);
  }

  static restore(p: OrderProps) {
    return new Order(p.id, p.customerId, p.items, p.status);
  }

  get status() { return this._status; }
  get items(): readonly OrderItem[] { return [...this._items]; }
  get total() { return this._items.reduce((sum, i) => sum.add(i.subtotal), Money.zero()); }

  addItem(productId: string, qty: number, unitPrice: Money) { /* guia de referência */ }
  place() { /* guia de referência */ }
  pay() { /* guia de referência, sem o record() por enquanto */ }
  isOwnedBy(userId: string) { return this.customerId === userId; }
}
```

- `create` aplica as regras de um pedido novo. `restore` só reconstrói o estado salvo e vai ser usado pelo mapper no passo 14.
- Os getters de leitura existem porque o mapper precisa ler o estado. Não há setters: o estado muda só pelos métodos de negócio.
- Os erros ficam em `domain/errors/` e estendem `DomainError`, cada um com seu `code`.
- `AggregateRoot` e `version` ficam de fora por enquanto. Entram quando forem necessários (passos 21 e 24).

Testes: adicionar o mesmo produto soma a quantidade, não edita depois de fechado, não fecha vazio, não paga rascunho, não paga duas vezes e o total está correto.

**Pronto quando:** os testes passam e nenhum arquivo em `domain/` importa pacote npm.

---

## Fase 2: casos de uso, ainda sem framework

> **Status:** 🟡 Em andamento · **Início:** 2026-11-21 · **Conclusão:** —
>
> - [x] Passo 4: contrato do repositório e repositório em memória
> - [ ] Passo 5: ports e `CreateOrderUseCase`
> - [ ] Passo 6: ator e ownership (`PlaceOrderUseCase` e `PayOrderUseCase`)

### Passo 4: contrato do repositório e repositório em memória

**Por quê:** o caso de uso precisa salvar e buscar pedidos. O banco ainda não existe, e o caso de uso não deve saber qual banco vai ser usado.

**Faça:**

- `domain/repositories/order.repository.ts` como `abstract class` (ver guia de referência). No passo 9, a mesma classe vira token de injeção do Nest.
- `infra/database/in-memory/in-memory-order.repository.ts`:

```ts
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  async save(order: Order) { this.orders.set(order.id, order); }
  async findById(id: string) { return this.orders.get(id) ?? null; }
}
```

Ele fica em `infra` porque é uma implementação. Serve aos testes agora e à primeira versão HTTP no passo 9.

**Pronto quando:** compila e o repositório tem um teste simples de salvar e buscar.

### Passo 5: ports e `CreateOrderUseCase`

**Por quê:** o ID e o preço vêm de fora do domínio. Com ports, o caso de uso fica testável com valores previsíveis.

**Faça:**

- `shared/application/ports/id-generator.ts`: `abstract class IdGenerator { abstract next(): string }`.
- `orders/application/ports/price-catalog.ts`:

```ts
export abstract class PriceCatalog {
  abstract pricesOf(productIds: string[]): Promise<Map<string, Money>>;
}
```

- `orders/application/dtos/create-order.input.ts`: um tipo simples, sem decorators.
- `CreateOrderUseCase`, copiado do guia de referência.
- Fakes em `test/fakes/`: `SequentialIdGenerator` (`order-1`, `order-2`...) e `FakePriceCatalog` (um `Map` fixo).

O preço nunca vem do cliente. A entrada traz só `productId` e quantidade.

Testes: cria o pedido com preços do catálogo, lança `ProductNotFoundError` para produto desconhecido e o pedido criado fica salvo no repositório.

**Pronto quando:** o caso de uso está testado só com fakes.

### Passo 6: ator e ownership (`PlaceOrderUseCase` e `PayOrderUseCase`)

**Por quê:** saber quem pode mexer em um pedido é regra de negócio. Ela existe antes do HTTP e da autenticação, e não depende deles.

**Faça:**

- `shared/application/actor.ts`: `type Actor = { id: string; roles: string[] }`.
- Os casos de uso recebem `{ orderId, actor }`, buscam o pedido, verificam a posse e chamam o método do domínio (ver [Autenticação e ownership](research/modules-ddd-clean-nest.md#autenticação-e-ownership)).
- Erros novos: `OrderNotFoundError` e `NotOrderOwnerError`.

Testes: o dono fecha e paga, outro usuário recebe `NotOrderOwnerError` e um admin consegue.

**Pronto quando:** os três casos de uso estão testados. Neste ponto o sistema funciona inteiro sem framework e sem banco.

---

## Fase 3: fronteiras automáticas

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 7: `dependency-cruiser` no CI

### Passo 7: `dependency-cruiser` no CI

**Por quê:** uma fronteira que ninguém verifica acaba quebrada. Instalar a verificação agora, com pouco código, custa menos do que corrigir dezenas de imports depois.

**Faça:**

```bash
npm i -D dependency-cruiser
npx depcruise --init
```

- Copie as regras `forbidden` do guia de referência ([Qualidade](research/modules-ddd-clean-nest.md#qualidade)). Inclua todas, até as de módulos, que ainda não custam nada.
- Tire os testes da análise com `options.exclude: { path: '\\.(spec|int-spec|e2e-spec)\\.ts$' }`. Um teste pode montar peças de várias camadas.
- Script `"arch": "depcruise src"`.
- No pipeline, rode `npm run typecheck && npm test && npm run arch`.

**Pronto quando:** você importa algo de `infra` dentro de `domain` só para testar e o `npm run arch` falha.

---

## Fase 4: NestJS como camada de entrega

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 8: instalar o Nest e subir a aplicação
> - [ ] Passo 9: `OrdersModule`, controller e DTO HTTP
> - [ ] Passo 10: erros de domínio viram status HTTP
> - [ ] Passo 11: teste e2e do fluxo principal

### Passo 8: instalar o Nest e subir a aplicação

**Por quê:** o domínio está pronto, e agora o sistema precisa de uma porta de entrada HTTP.

**Faça:**

```bash
npm i @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
npm i class-validator class-transformer
npm i -D @nestjs/cli @types/express
```

Adicione ao `tsconfig.json`:

```json
"experimentalDecorators": true,
"emitDecoratorMetadata": true
```

- `experimentalDecorators` habilita os decorators do Nest.
- `emitDecoratorMetadata` grava os tipos dos parâmetros do construtor, e é com eles que o Nest injeta dependências por classe.
- Mantenha `strict`. Em DTOs HTTP e ORM entities, que são preenchidos pelo framework, use `!` nas propriedades (`name!: string`).

Crie `tsconfig.build.json` estendendo o principal e excluindo `test` e `**/*spec.ts`, e um `nest-cli.json` com `{ "sourceRoot": "src" }`. Scripts: `"build": "nest build"` e `"start:dev": "nest start --watch"`.

```ts
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

O versionamento entra desde o primeiro dia porque, agora, não custa nada. Adicionar depois mudaria as URLs que os clientes já usam.

**Pronto quando:** `npm run start:dev` sobe a aplicação vazia.

### Passo 9: `OrdersModule`, controller e DTO HTTP

**Por quê:** o módulo Nest liga os contratos às implementações, e o controller traduz HTTP para chamadas de caso de uso.

**Faça:**

- `orders/infra/orders.module.ts` segue o guia de referência ([Camadas](research/modules-ddd-clean-nest.md#camadas)), com estas implementações por enquanto:
  - `OrderRepository` com `useClass: InMemoryOrderRepository`. O provider é singleton por padrão, então os dados sobrevivem entre requisições.
  - `PriceCatalog` com `useClass: StaticPriceCatalog`, um `Map` fixo em `infra/gateways/`. É **provisório** e sai no passo 22.
  - `IdGenerator` com `useClass: UuidV7Generator`, em `shared/infra/ids/` (`npm i uuid`, `import { v7 } from 'uuid'`).
  - Cada caso de uso registrado com `useFactory` e `inject`. O `useFactory` é o mesmo `new` que os testes já fazem, por isso o caso de uso não precisa de `@Injectable`.
- `infra/http/dtos/create-order.request.ts` com `class-validator`: `items` é array com `@ValidateNested` e `@Type`, cada item tem `productId` string e `qty` inteiro maior ou igual a 1, e o array tem tamanho máximo.
- `infra/http/controllers/orders.controller.ts` com `POST /orders`, `POST /orders/:id/place` e `POST /orders/:id/pay`.
- `shared/infra/auth/current-user.decorator.ts`, copiado do guia de referência.
- Guard **provisório**, para ter um `Actor` antes da autenticação real (sai no passo 19):

```ts
// shared/infra/auth/dev-auth.guard.ts  (PROVISÓRIO)
@Injectable()
export class DevAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const id = req.header('x-user-id');
    if (!id) throw new UnauthorizedException();
    req.user = { id, roles: (req.header('x-user-roles') ?? '').split(',').filter(Boolean) } satisfies Actor;
    return true;
  }
}
```

Registre-o no `AppModule` com `{ provide: APP_GUARD, useClass: DevAuthGuard }`.

**Pronto quando:** `POST /v1/orders` com o header `x-user-id` cria um pedido, um corpo com campo extra devolve 400 e nenhum arquivo de `domain` ou `application` mudou.

### Passo 10: erros de domínio viram status HTTP

**Por quê:** hoje um `OrderAlreadyPaidError` vira 500. O domain não pode conhecer HTTP, então a tradução acontece na infra.

**Faça:**

```ts
// orders/infra/http/filters/domain-error.filter.ts
const STATUS: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  NOT_ORDER_OWNER: 403,
  ORDER_ALREADY_PAID: 409,
  ORDER_NOT_EDITABLE: 409,
  EMPTY_ORDER: 422,
};

@Catch(DomainError)
export class OrdersDomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(STATUS[error.code] ?? 422).json({ code: error.code, message: error.message });
  }
}
```

Aplique com `@UseFilters(OrdersDomainErrorFilter)` no controller. Para esconder que o pedido existe, `NOT_ORDER_OWNER` pode responder 404.

**Pronto quando:** pagar duas vezes devolve 409 com o `code` no corpo.

### Passo 11: teste e2e do fluxo principal

**Por quê:** os testes unitários não pegam erro de ligação (provider faltando, rota errada). Um teste e2e cobre o caminho real.

**Faça:**

```bash
npm i -D @nestjs/testing supertest @types/supertest
```

- `test/orders.e2e-spec.ts` cobre: criar, fechar, pagar, pagar de novo (409) e outro usuário tentando pagar (403 ou 404).
- Script `"test:e2e": "jest --testRegex '.*\\.e2e-spec\\.ts$'"`. A regex padrão do Jest não pega `.e2e-spec` nem `.int-spec`, então `npm test` continua rodando só os unitários.

Poucos testes e2e bastam, só para os fluxos críticos.

**Pronto quando:** o e2e passa com o repositório em memória.

---

## Fase 5: configuração e banco de dados

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 12: configuração validada
> - [ ] Passo 13: Postgres e TypeORM
> - [ ] Passo 14: repositório TypeORM do `Order`
> - [ ] Passo 15: migrations por módulo
> - [ ] Passo 16: testes de integração com Testcontainers

### Passo 12: configuração validada

**Por quê:** o banco precisa de URL e, mais adiante, o JWT vai precisar de segredo. Com configuração inválida, a aplicação não deve subir.

**Faça:**

```bash
npm i @nestjs/config
```

- `ConfigModule.forRoot` no `AppModule` e `validateEnv` em `shared/infra/config/env.validation.ts`, os dois do guia de referência ([Infra: configuração, jobs, cache e serviços externos](research/modules-ddd-clean-nest.md#infra-configuração-jobs-cache-e-serviços-externos)).
- Valide só o que já existe: `NODE_ENV`, `PORT` e `DATABASE_URL`. O `JWT_SECRET` entra no passo 18.
- Versione um `.env.example` sem valores reais.

**Pronto quando:** sem `DATABASE_URL`, a aplicação não sobe e mostra uma mensagem clara.

### Passo 13: Postgres e TypeORM

**Por quê:** os dados se perdem a cada reinício. Hora de persistir.

**Faça:**

```bash
npm i typeorm@^1 @nestjs/typeorm@^11.0.1 pg
```

As versões 10 e 11.0.0 do `@nestjs/typeorm` quebram na inicialização com o TypeORM 1.0.

`docker-compose.yml` com um serviço `postgres` (imagem oficial, porta 5432 e volume).

```ts
// shared/infra/database/database.module.ts
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    type: 'postgres',
    url: cfg.getOrThrow('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
  }),
}),
```

Com `synchronize: false` desde já, o schema só muda por migration (passo 15).

**Pronto quando:** a aplicação conecta no Postgres do compose.

### Passo 14: repositório TypeORM do `Order`

**Por quê:** trocar o repositório em memória pelo real deve mexer só na infra. É aqui que a separação das fases anteriores se paga.

**Faça:**

- ORM entities em `infra/database/typeorm/entities/`, com `schema: 'orders'` (ver [Persistência com TypeORM](research/modules-ddd-clean-nest.md#persistência-com-typeorm)):
  - `OrderOrmEntity`: `id` (`uuid`, gerado pelo domínio, não pelo banco), `customerId`, `status`, `createdAt` e `updatedAt` (`@CreateDateColumn` e `@UpdateDateColumn`, que são detalhe técnico e não vão para o domínio), além de `items` com `cascade: true`.
  - `OrderItemOrmEntity`: chave composta (`orderId` e `productId`), `qty`, `unitPriceCents` como `bigint` e `currency`, além de `@ManyToOne` com `onDelete: 'CASCADE'` e `orphanedRowAction: 'delete'`.
- `typeorm-order.mapper.ts`: `toDomain` usa `Order.restore` e converte o `bigint`, que chega como `string`, com `Number(...)`. `toPersistence` lê os getters.
- `typeorm-order.repository.ts` usa `this.dataSource.manager` por enquanto. No passo 20 ele passa a usar a transação ativa.
- No módulo, `TypeOrmModule.forFeature([...])` e `useClass: TypeOrmOrderRepository`.

A chave composta faz o `save()` atualizar o item existente em vez de apagar e inserir de novo. Já o `orphanedRowAction` apaga o item que saiu do array.

**Pronto quando:** só a infra mudou. Domain, casos de uso e controller continuam iguais. (O banco ainda não tem tabelas: elas vêm no próximo passo.)

### Passo 15: migrations por módulo

**Por quê:** cada módulo é dono do próprio schema. As migrations de um módulo não podem tocar nas tabelas de outro.

**Faça:**

```bash
npm i dotenv
npm i -D ts-node
```

- `orders.data-source.ts` (ver [Módulos independentes](research/modules-ddd-clean-nest.md#módulos-independentes)) com as entidades do módulo e `migrationsTableName: 'orders_migrations'`. Ele carrega o `.env` com `dotenv` e reaproveita o `validateEnv`.
- Primeira migration, criada vazia com `migration:create`, só com `CREATE SCHEMA IF NOT EXISTS orders`. Rode-a.
- Em seguida, `npm run mig:orders:gen` gera as tabelas. **Revise o SQL** antes do commit.
- Scripts `mig:orders:gen` e `mig:orders:run`, copiados do guia de referência.

**Pronto quando:** `mig:orders:run` cria o schema e as tabelas, e o e2e passa com o banco real.

### Passo 16: testes de integração com Testcontainers

**Por quê:** mapper e repositório só são testados de verdade contra um Postgres real, e as migrations também precisam ser testadas.

**Faça:**

```bash
npm i -D @testcontainers/postgresql
```

- `*.int-spec.ts` sobe um Postgres descartável, roda as migrations reais do módulo e testa:
  - salvar e buscar um pedido com itens
  - remover um item do array e salvar (a linha tem que sumir)
  - conversão do `bigint` para `number`
- Script `"test:int": "jest --testRegex '.*\\.int-spec\\.ts$'"`.
- Opcional: rodar o e2e no mesmo container.

**Pronto quando:** `npm run test:int` passa do zero, sem banco local.

---

## Fase 6: leitura

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 17: `OrderQueries` (CQRS leve) e paginação

### Passo 17: `OrderQueries` (CQRS leve) e paginação

**Por quê:** listar "meus pedidos" não exige montar agregados. A listagem precisa ser rápida, filtrada pelo dono e paginada.

**Faça:**

- `shared/application/page.ts` com `PageRequest` e `Page<T>`.
- `shared/infra/http/pagination.query.ts` com `PaginationQuery` (`limit` máximo de 100).
- `orders/application/queries/order.queries.ts`: classe abstrata com `listByCustomer(customerId, page)`.
- `infra/database/typeorm/typeorm-order.queries.ts`: query builder devolvendo um DTO pronto, sem agregado (ver [Paginação](research/modules-ddd-clean-nest.md#paginação)).
- `GET /v1/orders` passa `actor.id` para a query. O filtro de dono fica na query, nunca depois de carregar.

Comece com offset. Troque para cursor quando a lista crescer ou virar scroll infinito.

**Pronto quando:** um usuário só vê os próprios pedidos e `limit=500` devolve 400.

---

## Fase 7: autenticação

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 18: módulo `identity`
> - [ ] Passo 19: guard global e fim do guard provisório

### Passo 18: módulo `identity`

**Por quê:** até aqui o ator vinha de um header que qualquer um forja. Agora o sistema precisa de usuários reais e de um token assinado.

**Faça:**

- Novo módulo `identity` com a estrutura completa e schema `identity` próprio:
  - domain: `User`, value object `Email` e erros (`EmailAlreadyInUse`, `InvalidCredentials`).
  - application: `RegisterUserUseCase` e `LoginUseCase`, com os ports `PasswordHasher` e `TokenIssuer`.
  - infra: adapters `Argon2PasswordHasher` (ou bcrypt) e `JwtTokenIssuer` (`@nestjs/jwt`), repositório, migrations e controller.
- E-mail único em dois níveis: verificação no caso de uso e constraint `UNIQUE` no banco.
- O token carrega `sub`, `roles` e, se houver, `tenantId`.
- `JWT_SECRET` entra na validação de ambiente.

O `Email` fica no `identity`. Ele só vai para o `shared` se outro módulo precisar exatamente da mesma regra (na dúvida, duplique).

**Pronto quando:** cadastro e login funcionam e o login devolve um JWT.

### Passo 19: guard global e fim do guard provisório

**Por quê:** toda rota nova deve nascer protegida, e o `DevAuthGuard` precisa sair.

**Faça:**

- `shared/infra/auth/jwt-auth.guard.ts`: valida o token, monta o `Actor` e coloca em `req.user`. Ele **não** consulta a tabela de usuários.
- `@Public()` com `SetMetadata`. O guard lê com o `Reflector` e libera a rota marcada.
- Troque `DevAuthGuard` por `JwtAuthGuard` no `APP_GUARD` e apague o `DevAuthGuard`.
- Marque `register` e `login` como `@Public()`.
- Para rotas só de admin, use um `RolesGuard`. Regras por recurso continuam no caso de uso.

Como alternativa, a documentação atual do Nest apresenta o `@nestjs/authentication`, que já traz guard global, `@Public()` e `@CurrentUser()`.

**Pronto quando:** rota sem token devolve 401, o e2e faz login antes de criar o pedido e não sobra nenhuma referência a `x-user-id`.

---

## Fase 8: consistência dentro do módulo

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 20: `TransactionManager`
> - [ ] Passo 21: optimistic locking no `Order`

### Passo 20: `TransactionManager`

**Por quê:** daqui em diante, um caso de uso grava mais de uma coisa por vez: a raiz com checagem de versão mais os itens, depois o pedido mais a outbox. Ou grava tudo, ou não grava nada.

**Faça:**

- Port `shared/application/ports/transaction-manager.ts` e a implementação `shared/infra/database/typeorm-transaction-manager.ts` com `AsyncLocalStorage` (ver [Transações, concorrência e eventos](research/modules-ddd-clean-nest.md#transações-concorrência-e-eventos)).
- Se já houver uma transação ativa, reaproveite em vez de abrir outra:

```ts
run<T>(work: () => Promise<T>) {
  if (txStore.getStore()) return work();
  return this.dataSource.transaction(em => txStore.run(em, work));
}
```

- O `DatabaseModule` exporta o `TransactionManager` como global.
- Os repositórios trocam `dataSource.manager` por `txStore.getStore() ?? dataSource.manager`.
- Os casos de uso que gravam passam a envolver a escrita em `this.tx.run(...)`.

Nos testes unitários, use um `FakeTransactionManager` que só executa `work()`.

Se preferir uma solução pronta, o `@nestjs-cls/transactional` faz a mesma propagação. Mantenha o port na application de qualquer forma.

**Pronto quando:** um teste de integração que lança erro no meio do `tx.run` não deixa nada gravado.

### Passo 21: optimistic locking no `Order`

**Por quê:** duas requisições podem carregar o mesmo pedido e as duas gravarem, e uma sobrescreve a outra sem aviso.

**Faça:**

- O `Order` passa a ter `version` (0 em `create`, valor do banco em `restore`).
- `version` vira uma coluna `int` comum na ORM entity, sem `@VersionColumn`.
- O `save` do repositório, dentro da transação:

```ts
const next = order.version + 1;
if (order.version > 0) {
  const res = await manager.update(OrderOrmEntity, { id: order.id, version: order.version }, { version: next });
  if (res.affected === 0) throw new ConcurrencyError();
}
await manager.getRepository(OrderOrmEntity).save({ ...OrderMapper.toPersistence(order), version: next });
```

- `ConcurrencyError` estende `DomainError` em `shared/domain/` e vira 409 nos filters.

**Pronto quando:** um teste de integração que carrega o mesmo pedido duas vezes e salva as duas cópias recebe `ConcurrencyError` na segunda.

---

## Fase 9: vários módulos conversando

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 22: módulo `catalog` como CRUD simples, com facade
> - [ ] Passo 23: módulo `inventory` e reserva síncrona

### Passo 22: módulo `catalog` como CRUD simples, com facade

**Por quê:** o preço tem dono, que é o catálogo. O `StaticPriceCatalog` provisório sai.

**Faça:**

- `catalog` é um cadastro simples, então não precisa de DDD completo: controller, service e repositório TypeORM, dentro de `modules/catalog/` e com schema `catalog` próprio (ver [Pragmatismo e checklist](research/modules-ddd-clean-nest.md#pragmatismo-e-checklist)).
- `catalog/contracts/catalog.facade.ts`:

```ts
export abstract class CatalogFacade {
  abstract pricesOf(productIds: string[]): Promise<{ productId: string; priceCents: number; currency: string }[]>;
}
```

- `CatalogModule` exporta **só** a `CatalogFacade`.
- Em orders, o `CatalogPriceAdapter` em `infra/gateways/` implementa `PriceCatalog`, chama a facade e converte centavos em `Money`.
- `OrdersModule` importa `CatalogModule` e troca o `useClass` do `PriceCatalog`.

O contrato expõe só primitivos. A regra `contracts-sem-domain-e-infra` impede usar até o `Money` do shared ali.

**Pronto quando:** o `StaticPriceCatalog` foi apagado, o `npm run arch` passa e orders não importa nada de `catalog` fora de `contracts/`.

### Passo 23: módulo `inventory` e reserva síncrona

**Por quê:** fechar um pedido precisa reservar estoque. O estoque tem regras e ciclo de vida próprios, então é outro módulo, não parte do agregado.

**Faça:**

- `inventory` com a estrutura completa e schema `inventory`.
- `ReserveStockUseCase`, dentro de `tx.run`:
  1. Insere a reserva com `UNIQUE(reference_id)` e `ON CONFLICT DO NOTHING`. Se a linha já existia, a reserva foi feita antes e o caso de uso retorna sem fazer nada.
  2. Para cada item, faz o update atômico condicional (`available >= :qty`). Se algum afetar 0 linhas, lança `InsufficientStockError` e a transação desfaz tudo.
- `InventoryFacade` em `contracts/`, e o `InventoryModule` exporta só ela.
- Em orders, o port `StockGateway` e o adapter `InventoryStockGateway` (ver [Agregados e comunicação entre módulos](research/modules-ddd-clean-nest.md#agregados-e-comunicação-entre-módulos)).
- O `PlaceOrderUseCase` chama `stock.reserve(order.id, items)` antes de `order.place()` e do `save`.

Limite conhecido: se o `save` falhar depois da reserva, sobra estoque reservado. Por enquanto, aceite isso ou compense com `release`. A fase 10 resolve de forma robusta.

**Pronto quando:** fechar um pedido debita o estoque, repetir a chamada não debita de novo e estoque insuficiente devolve 409.

---

## Fase 10: eventos

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 24: `AggregateRoot` e eventos de domínio
> - [ ] Passo 25: outbox
> - [ ] Passo 26: worker de publicação
> - [ ] Passo 27: consumidores idempotentes
> - [ ] Passo 28: fluxos por evento e grafo sem ciclos
> - [ ] Passo 29: versionamento de contratos e testes de contrato

### Passo 24: `AggregateRoot` e eventos de domínio

**Por quê:** pagar um pedido precisa avisar outros módulos. Se a entidade publicasse direto e o `save` falhasse, os outros reagiriam a algo que não aconteceu.

**Faça:**

- `shared/domain/aggregate-root.ts` com `record` e `pullEvents` (ver guia de referência).
- `Order extends AggregateRoot`, e `pay()` passa a chamar `this.record(new OrderPaid(this.id))`.
- O teste de `pay()` também verifica o evento registrado.

**Pronto quando:** `order.pullEvents()` devolve `OrderPaid` depois de `pay()` e esvazia a lista.

### Passo 25: outbox

**Por quê:** o evento só pode sair se a transação confirmar, e não pode se perder se a aplicação cair logo depois.

**Faça:**

- Port `Outbox` em `shared/application/ports/` e tabela `outbox` em `shared/infra/outbox/`, com migration própria.
- Contrato público `orders/contracts/events/order-paid.event.ts` (`OrderPaidV1`), com `eventId`, `type`, `version`, `occurredAt` e payload só com primitivos.
- O port `Clock` entra agora, em `shared/application/ports/clock.ts`, para preencher o `occurredAt`. Nos testes, use `FixedClock`.
- O `PayOrderUseCase` converte o evento de domínio para o contrato e grava os dois no mesmo `tx.run`:

```ts
await this.tx.run(async () => {
  await this.orders.save(order);
  await this.outbox.add(order.pullEvents().map(e => this.toContract(e)));
});
```

**Pronto quando:** pagar um pedido cria uma linha na outbox, e uma falha no `save` não cria nenhuma.

### Passo 26: worker de publicação

**Por quê:** alguém precisa ler a outbox e entregar os eventos.

**Faça:**

```bash
npm i @nestjs/event-emitter
```

- O worker em `shared/infra/outbox/` busca lotes com `FOR UPDATE SKIP LOCKED`, publica no `EventEmitter2` e marca como enviado.
- Retry com backoff exponencial e contador de tentativas. Depois de N falhas, o evento vai para a fila de mensagens mortas.
- Publique em ordem de criação por agregado.
- Um job de limpeza apaga os eventos publicados antigos.

Com o outbox, trocar o barramento em memória por RabbitMQ ou Kafka depois muda só o publicador.

**Pronto quando:** um handler de teste recebe `orders.order-paid`, e com dois workers rodando cada evento sai uma vez só.

### Passo 27: consumidores idempotentes

**Por quê:** a outbox entrega pelo menos uma vez, então o mesmo evento pode chegar duas vezes.

**Faça:**

- Tabela `processed_events` com `UNIQUE(event_id, consumer)`.
- Todo handler roda dentro de `tx.run` e começa com `tryMark` (`INSERT ... ON CONFLICT DO NOTHING`). Se não inseriu, retorna (ver guia de referência).

Verificar com `exists` antes de processar não resolve a corrida entre duas entregas simultâneas. Só a constraint resolve.

**Pronto quando:** entregar o mesmo evento duas vezes produz o efeito uma vez só.

### Passo 28: fluxos por evento e grafo sem ciclos

**Por quê:** o inventory precisa reagir ao cancelamento de um pedido. Importar o `OrdersModule` criaria um ciclo, e um ciclo indica fronteira errada.

**Faça:**

- `Order.cancel()` registra `OrderCancelled`.
- No inventory, `OnOrderCancelledHandler` (idempotente) chama o `ReleaseStockUseCase`. O inventory **não** importa o `OrdersModule`, só o tipo do evento em `orders/contracts`.
- Regra fixa: uma direção pode ser síncrona (via facade), e a volta é sempre por evento.
- Opcional: se a compensação do passo 23 incomodar, migre o fechamento para eventos (`PENDING`, depois `OrderPlaced`, e por fim `StockReserved` ou `StockReservationFailed`). Como orders só conhece o port `StockGateway`, domain e casos de uso mudam pouco.

**Pronto quando:** cancelar um pedido libera o estoque e a regra `no-circular` passa sem `forwardRef`.

### Passo 29: versionamento de contratos e testes de contrato

**Por quê:** eventos e facades são a API pública de cada módulo. Uma mudança sem cuidado quebra outro módulo em silêncio.

**Faça:**

- Siga as regras de versão do guia de referência ([Dependências e contratos entre módulos](research/modules-ddd-clean-nest.md#dependências-e-contratos-entre-módulos)): mudança aditiva mantém a versão, e mudança que quebra publica v1 e v2 juntas.
- Guarde exemplos versionados de cada evento em `contracts/` e teste os dois lados: quem publica gera um payload compatível, e quem consome entende o exemplo.

**Pronto quando:** remover um campo do `OrderPaidV1` quebra um teste.

---

## Fase 11: pronto para produção

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 30: segurança HTTP
> - [ ] Passo 31: health check
> - [ ] Passo 32: logs e tracing
> - [ ] Passo 33: documentação da API
> - [ ] Passo 34: jobs agendados
> - [ ] Passo 35: cache na leitura
> - [ ] Passo 36: serviços externos e `Idempotency-Key`
> - [ ] Passo 37: seeds

Cada passo desta fase é independente. Faça na ordem que a operação pedir.

### Passo 30: segurança HTTP

**Por quê:** a API vai ficar exposta.

**Faça:** `helmet` no `main.ts`, `enableCors` só com origens conhecidas e `@nestjs/throttler` como `APP_GUARD`, com limite mais rígido em `login`. Com várias instâncias, use storage em Redis. Atrás de proxy, configure `trust proxy`.

**Pronto quando:** vários logins seguidos devolvem 429.

### Passo 31: health check

**Por quê:** o orquestrador precisa saber se o processo está vivo e se está pronto para receber tráfego.

**Faça:** `@nestjs/terminus` com `/health/live` (só o processo) e `/health/ready` (`pingCheck` no banco), ambos com `VERSION_NEUTRAL` e `@Public()`. O `enableShutdownHooks` já está ativo desde o passo 8.

**Pronto quando:** com o banco parado, o `ready` falha e o `live` continua respondendo.

### Passo 32: logs e tracing

**Por quê:** uma requisição passa por vários módulos e pela outbox, e sem rastreio não dá para segui-la.

**Faça:** `nestjs-pino` para logs em JSON e OpenTelemetry com auto-instrumentação. Inclua o `traceId` em todo log e nos metadados de cada evento da outbox. Na application, use um port `Logger`.

**Pronto quando:** dá para seguir um pagamento do HTTP até o handler do evento pelo `traceId`.

### Passo 33: documentação da API

**Por quê:** quem consome a API precisa de um contrato legível.

**Faça:** `@nestjs/swagger` com o plugin da CLI, uma `@ApiTags` por módulo e decorators só em controllers e DTOs HTTP.

**Pronto quando:** `/docs` mostra as rotas v1 agrupadas por módulo.

### Passo 34: jobs agendados

**Por quê:** pedidos esquecidos em `DRAFT` ou `PENDING` precisam expirar.

**Faça:** `ExpirePendingOrdersUseCase` usando o `Clock` e `ExpirePendingOrdersJob` em `infra/jobs/` com `@nestjs/schedule`. O job só chama o caso de uso. Com várias instâncias, use um lock no banco ou os Job Schedulers do BullMQ (`upsertJobScheduler`).

**Pronto quando:** o caso de uso tem teste com `FixedClock` e o job não roda em duplicidade.

### Passo 35: cache na leitura

**Por quê:** algumas leituras são frequentes e mudam pouco.

**Faça:** `CachedOrderQueries` envolvendo `OrderQueries`, registrado no módulo no lugar da implementação direta. A invalidação acontece por evento (`OrderPaid` remove a chave). Nunca use cache para carregar agregados que vão ser alterados.

**Pronto quando:** a application não sabe que o cache existe.

### Passo 36: serviços externos e `Idempotency-Key`

**Por quê:** pagamento, e-mail e storage são externos e falham.

**Faça:**

- Ports na application (`PaymentGateway`, `EmailSender`) e adapters na infra que traduzem os erros do fornecedor.
- Timeout em toda chamada, retry só em operação idempotente e circuit breaker (`opossum`) para dependências instáveis.
- `POST /orders/:id/pay` aceita o header `Idempotency-Key`. Guarde a chave com a impressão digital do corpo, a resposta e um prazo de expiração.

**Pronto quando:** repetir o pagamento com a mesma chave devolve a mesma resposta sem cobrar de novo.

### Passo 37: seeds

**Por quê:** desenvolvimento e testes manuais precisam de dados.

**Faça:** dados obrigatórios vão em migration. Dados de desenvolvimento vão em seeds por módulo (`infra/database/typeorm/seeds`), com script `seed:<módulo>` e upsert.

**Pronto quando:** rodar o seed duas vezes não duplica nada.

---

## Fase 12: escala do time

> **Status:** ⬜ Não iniciada · **Início:** — · **Conclusão:** —
>
> - [ ] Passo 38: gerador de módulos
> - [ ] Passo 39: evoluções sob demanda

### Passo 38: gerador de módulos

**Por quê:** a partir do terceiro módulo, criar a estrutura à mão gera divergência.

**Faça:** `plop` com um template baseado no módulo `orders` (ver guia de referência). O template já inclui o módulo Nest com `useFactory`, o DataSource, a primeira migration com `CREATE SCHEMA` e os scripts de migration.

**Pronto quando:** `npx plop module` gera um módulo que passa no `npm run arch` sem ajustes.

### Passo 39: evoluções sob demanda

Só adote estes itens quando a necessidade aparecer:

| Necessidade | O que fazer | Referência |
| --- | --- | --- |
| Regra que envolve dois agregados | Domain service puro em `domain/services` | Modelagem do domínio |
| Cancelar ou arquivar com significado de negócio | Estado no domínio (`order.cancel()`), não `deletedAt` | Modelagem do domínio |
| Saber quem criou ou alterou | `createdBy` preenchido pela infra a partir do `Actor` no contexto | Modelagem do domínio |
| Lista grande ou scroll infinito | Paginação por cursor (keyset) | Paginação |
| Dividir valores (parcelas, rateio) | `Money.allocate` | Modelagem do domínio |
| Isolamento máximo de dados | Conexão e usuário de banco por módulo | Módulos independentes |
| Vários clientes no mesmo sistema | `tenantId` no token, em toda entidade e em toda query | Autenticação e ownership |
| Mudança que quebra a API HTTP | `OrdersV2Controller` chamando os mesmos casos de uso e header `Sunset` na v1 | Dependências e contratos entre módulos |
| Módulo com carga ou time próprio | Extrair para microsserviço trocando só adapters e publicador | Operação |

O último item é o retorno de todo o isolamento construído antes: domain e application não mudam.
