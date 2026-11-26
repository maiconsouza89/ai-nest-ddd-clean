---
type: how-to
---

# Como proteger uma rota

Use este guia quando uma rota nova precisa de login, de uma role ou de ser restrita ao dono do recurso.

## Pré-requisitos

- O controller e o caso de uso da rota existem ([Como criar um módulo](criar-um-modulo.md)).
- Para restringir ao dono: o recurso guarda o id de quem o criou, como o `customerId` do `Order`.
- Para o teste e2e: o Postgres, o Redis e o Mailpit do docker-compose no ar, e nenhum `start:dev` deste checkout rodando ([Comandos](../reference/comandos.md#testes)).

## Passos

1. Para exigir login, não faça nada na rota: o guard de autenticação é global, e toda rota nasce protegida. Só o `@Public()`, de `#shared/infra/auth/public.decorator`, abre uma rota. Confira que o controller tem o `@ApiBearerAuth()`, que o `plop module` já gera, para o Swagger enviar o token:

   ```ts
   @ApiTags('orders')
   @ApiBearerAuth()
   @Controller('orders')
   export class OrdersController {
   ```

2. Para saber quem chama, receba o ator com o `@CurrentUser()` e repasse-o ao caso de uso como dado. O modelo é o `orders.controller.ts`:

   ```ts
   import type { Actor } from '#shared/application/actor';
   import { CurrentUser } from '#shared/infra/auth/current-user.decorator';

   @Get(':id')
   @ApiOkResponse({ type: OrderDetailsResponse })
   get(
     @Param('id', ParseUUIDPipe) id: string,
     @CurrentUser() actor: Actor,
   ): Promise<OrderDetailsResponse> {
     return this.getOrder.execute({ orderId: id, actor });
   }
   ```

   O `Actor` tem o `id` e as `roles` do usuário, lidos do banco a cada requisição.

3. Para restringir a rota inteira a uma role, acrescente o `@Roles(...)`, de `#shared/infra/auth/roles.decorator`, como o `products.controller.ts`:

   ```ts
   @Post()
   @Roles('admin')
   @ApiCreatedResponse({ type: ProductResponse, description: 'Produto criado.' })
   create(@Body() body: CreateProductRequest): Promise<ProductResponse> {
     return this.products.create(body);
   }
   ```

   Com mais de uma role, basta o ator ter uma delas. No controller, e não num método, o decorator vale para todas as rotas dele. Um `@Roles` no método substitui o do controller, e não soma a ele. Não ponha um `@Public()` num controller com `@Roles`: a rota pública não carrega o ator e responde 403 para todos.

4. Para restringir ao dono do recurso, ponha a regra no caso de uso, e não num guard ([Autenticação e ownership](../explanation/autenticacao.md#ownership-no-caso-de-uso)):
   1. Crie o erro de dono, com status 403 no mapa do módulo, como o `NotOrderOwnerError` (`NOT_ORDER_OWNER`), seguindo [Como lançar um erro de domínio](lancar-um-erro-de-dominio.md).
   2. Escreva a regra numa função da application, que o caso de uso chama depois de carregar o recurso. Recurso que não existe lança o erro de não encontrado (404) antes da regra de dono. O modelo é o `order-access.ts` do orders:

      ```ts
      export function assertCanAccessOrder(actor: Actor, customerId: string) {
        const isAdmin = actor.roles.includes('admin');
        if (customerId !== actor.id && !isAdmin) throw new NotOrderOwnerError();
      }
      ```

      ```ts
      // get-order.use-case.ts
      async execute({ orderId, actor }: OrderActionInput): Promise<OrderDetails> {
        const order = await this.queries.getById(orderId);
        if (!order) throw new OrderNotFoundError();
        assertCanAccessOrder(actor, order.customerId);
        return order;
      }
      ```

   3. Ao criar o recurso, grave o dono a partir do ator, e nunca de um campo do corpo: `this.createOrder.execute({ customerId: actor.id, items: body.items })`.
   4. Numa listagem, filtre pelo ator na query, e não depois de carregar: `this.orderQueries.listByCustomer(actor.id, query)` ([Como paginar uma listagem](paginar-uma-listagem.md)).

5. Cubra a regra de dono no teste unitário do caso de uso, com o dono, um admin, outro ator e um id que não existe. O ator é um objeto montado no teste. O modelo é o `get-order.use-case.spec.ts`:

   ```ts
   await expect(
     getOrder.execute({ orderId: 'o1', actor: { id: 'u2', roles: [] } }),
   ).rejects.toThrow(NotOrderOwnerError);
   ```

6. Confira as respostas num teste e2e, em `test/<assunto>.e2e-spec.ts`. Importe o `enable-outbox-worker` antes do `AppModule`, porque o `registerAndLogin` verifica o e-mail com o código que sai por evento:

   ```ts
   import './helpers/enable-outbox-worker.js';
   import { AppModule } from '../src/app.module.js';
   import { registerAndLogin, setRoles } from './helpers/auth.js';
   ```

   Cubra os três casos:
   - **401 sem token:** a chamada sem o cabeçalho `Authorization` responde 401, com o `code` `UNAUTHORIZED`.
   - **403 de role:** um usuário do `registerAndLogin` nasce sem roles e recebe 403, com o `code` `FORBIDDEN`. Depois de `setRoles(app, user.id, ['admin'])`, o mesmo token passa. O modelo é o bloco "guard global" do `auth.e2e-spec.ts`, que usa uma rota só de teste; troque-a pela sua:

     ```ts
     const user = await registerAndLogin(app);
     const adminOnly = () => request(server()).post('/v1/<rota de admin>').set(user.auth);

     await adminOnly().expect(403);
     await setRoles(app, user.id, ['admin']);
     await adminOnly().expect(200); // o status de sucesso da rota
     ```

   - **403 de dono:** dois usuários, o recurso criado por um e pedido pelo outro, com o `code` do erro de dono. O modelo é o `orders.e2e-spec.ts`:

     ```ts
     const owner = await registerAndLogin(app);
     const other = await registerAndLogin(app);
     const id = await createOrder(owner);

     const forbidden = await request(server()).get(`/v1/orders/${id}`).set(other.auth).expect(403);
     expect(forbidden.body.code).toBe('NOT_ORDER_OWNER');
     ```

7. Na página do módulo, em `docs/reference/modules/<módulo>.md`, registre a role de cada rota na tabela do contrato público e diga quais rotas só valem para o dono.

## Como verificar

- `npm test -- <nome do spec>` passa.
- `npm run test:e2e -- <nome do e2e>` passa.
- Com a app no ar (`npm run start:dev`) e os seeds aplicados, a rota responde 401 sem token, 403 com o token do `user@example.com` numa rota de `admin` e o status de sucesso com o token do `admin@example.com`. Os dois usuários e a senha estão em [Autenticação](../reference/autenticacao.md#usuários-de-teste).

## Veja também

- [Autenticação](../reference/autenticacao.md#rotas-protegidas): o guard global, as roles e a resposta de cada situação.
- [Autenticação e ownership](../explanation/autenticacao.md): por que a autenticação fica na infra e a regra de dono no caso de uso, e a escolha entre 403 e 404 para quem não é o dono.
- [Camadas](../reference/camadas.md#application): a linha "Ownership".
- [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md): o ator carregado a cada requisição.
