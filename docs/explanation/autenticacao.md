---
type: explanation
---

# Autenticação e ownership

Por que a autenticação fica na infra e o ownership no caso de uso, por que a sessão vive num refresh token rotativo e onde cada peça mora. Rotas, prazos e respostas estão em [Autenticação](../reference/autenticacao.md). A decisão de carregar o ator a cada requisição está na [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md).

## Contexto

Duas perguntas diferentes aparecem em toda requisição. **Quem é você?** é autenticação: depende de token, cabeçalho e assinatura, e é igual para todas as rotas. **Você pode mexer neste recurso?** é ownership: depende do recurso, do dono dele e da regra de negócio, e muda de módulo para módulo.

Por isso a autenticação fica na infra, num guard global do `shared`, e o ownership fica no caso de uso ou na entidade de cada módulo. O que liga as duas é o `Actor`, um tipo puro do `shared` (`{ id, roles, tenantId? }`) que o guard monta e o controller repassa como dado.

## Por quê

### O token só identifica, o ator vem do banco

O access token leva só o `sub` e o `exp`. A cada requisição, o `JwtAuthGuard` busca o ator atual pelo port `ActorResolver`, numa leitura por PK. Uma role removida ou uma conta apagada valem na requisição seguinte, e não quando o token vencer. O motivo e as alternativas descartadas estão na [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md).

O port fica no `shared`, porque o guard é do `shared`. Quem o implementa é o `identity`, dono dos usuários. O `shared` não pode importar o `identity` (o `npm run arch` barra), então quem liga os dois é o `AppModule`, a raiz de composição:

```ts
// app.module.ts: o IdentityAuthModule exporta só o ActorResolver,
// e o AuthModule registra os guards globais
imports: [JwtConfigModule, AuthModule.forRoot({ imports: [IdentityAuthModule] }), ...]
```

O `IdentityModule` continua exportando só a facade ([ADR 0003](../adr/0003-imports-explicitos-entre-modulos.md)). Os outros módulos não consultam a tabela de usuários: recebem o `Actor` pronto.

### Protegido por padrão

O guard é global (`APP_GUARD`), e uma rota aberta precisa de `@Public()`. Esquecer o decorator numa rota nova deixa a rota fechada, e não aberta. O erro barato é o que pede autenticação a mais.

### O prazo do access token é do identity

O `JwtConfigModule`, no `shared`, fixa só o segredo e o algoritmo, que valem para assinar e para verificar. A validade é decisão de quem emite: o `TokenIssuer` do `identity` assina com o prazo e devolve o `expiresIn`. Como o `JwtConfigModule` não tem validade padrão, um token emitido sem `exp` valeria para sempre. Por isso o guard recusa token sem `exp`.

### A sessão vive no refresh token

Um access token não pode ser revogado antes de vencer, então a validade dele é curta (15 minutos). A sessão longa vive no refresh token, que pode ser revogado porque está no banco.

- **Opaco, guardado como hash.** São 32 bytes aleatórios. O banco guarda só o SHA-256: quem lê o banco não consegue usar os tokens. Com essa entropia, um hash rápido basta, sem o custo de um hash de senha, e a busca é por índice único.
- **Rotativo, de uso único.** Cada renovação troca o token por um sucessor, na mesma família (a sessão aberta no login). Se um token já trocado reaparece, duas partes têm o mesmo token, o cliente e quem o roubou, e não dá para saber qual é qual. A família inteira é revogada.
- **Prazo absoluto da família.** Renovar não estende a sessão além do prazo contado do login. Um token roubado não vira acesso eterno só por ser renovado em dia.

### A corrida da renovação

Duas renovações com o mesmo token podem chegar juntas. O caso de uso marca o uso com um update condicional (`usedAt IS NULL`) e grava o sucessor na mesma transação:

```ts
const session = await this.tx.run(async () => {
  const reused = token.wasUsed || !(await this.refreshTokens.markUsed(token.id, now));
  if (reused) {
    await this.refreshTokens.revokeFamily(token.familyId, now);
    return null;
  }
  return this.sessions.rotate(token);
});
// fora da transação: lançar dentro dela desfaria a revogação
if (!session) throw new InvalidRefreshTokenError();
```

A segunda renovação espera a linha do token ser liberada, não acha mais o `usedAt` nulo e revoga a família, já com o sucessor da primeira dentro. O 401 sai depois da transação, porque um erro lançado dentro dela desfaria a revogação. Um logout concorrente segue a mesma lógica: o `revokeFamily` trava as linhas da família (`SELECT ... FOR UPDATE`) antes do update, e assim também pega o sucessor de uma renovação em andamento.

O preço é não ter janela de tolerância. Um cliente que dispara duas renovações em paralelo, ou que repete uma renovação porque perdeu a resposta, perde a sessão e volta ao login.

### Ownership no caso de uso

A entidade sabe quem é o dono, guardando só o id dele, sem FK para o `identity`. O caso de uso decide se o ator pode agir:

```ts
// orders/application/order-access.ts
const order = await (lock ? repo.findByIdForUpdate(orderId) : repo.findById(orderId));
if (!order) throw new OrderNotFoundError();

const isAdmin = actor.roles.includes('admin');
if (!order.isOwnedBy(actor.id) && !isAdmin) throw new NotOrderOwnerError();
```

Um guard não resolveria isso: ele vê a rota e o token, mas não o pedido. A regra "o dono ou um admin" é de negócio, e o teste dela é um teste unitário do caso de uso, sem HTTP.

O `@Roles('admin')` e o `RolesGuard` ficam para o caso simples, em que a rota inteira é de uma role, sem olhar o recurso. Numa listagem, o filtro pelo ator vai na query (`listByCustomer(actor.id, page)`), e não num filtro depois de carregar tudo.

## Alternativas e trade-offs

- **403 ou 404 para quem não é o dono:** o orders responde 403 (`NOT_ORDER_OWNER`), que diz a verdade e facilita o diagnóstico. Em troca, revela que o pedido existe. Responder 404 esconderia a existência, ao custo de um erro menos claro para quem chama.
- **`@nestjs/authentication` e `@nestjs/authorization`:** a documentação do Nest apresenta esses pacotes, com guard global, `@Public()`, `@CurrentUser()`, refresh token de uso único e um guard de autorização que nega por padrão (`@Can()`). Estão na 0.1.x, e o projeto fica com o guard próprio sobre o `@nestjs/jwt` até a 1.0 ([ADR 0002](../adr/0002-ator-carregado-por-requisicao.md), [gatilho no plano de evolução](../plan/evolucao.md#passo-18-evoluções-sob-demanda)). Se adotar, o `validate()` do provider fica no `identity`, e o controller continua convertendo o usuário em `Actor` antes de chamar o caso de uso.
- **Janela de tolerância na renovação:** aceitar o token anterior por alguns segundos depois da troca salvaria o cliente que repete a renovação. Em troca, um token roubado usado dentro da janela passaria sem revogar a família. O projeto preferiu a detecção de reuso sem exceção.

### O que fica para quando surgir

- **Dados do dono:** o e-mail vem da `UserDirectoryFacade` (`emailOf`). Para outros dados, amplie a facade ou mantenha uma cópia local alimentada por evento. O `identity` não publica eventos, e um `UserRegistered` entraria para isso.
- **Multi-tenant:** o `Actor` tem `tenantId`, mas o `ActorResolver` não o preenche. Ao adotar, o `identity` guarda o tenant do usuário e o `ActorResolver` o devolve junto com as roles, nunca pelo token. O `tenantId` então vai em toda entidade e toda query.

## Decisões relacionadas

- [ADR 0002: Ator carregado a cada requisição](../adr/0002-ator-carregado-por-requisicao.md)
- [ADR 0003: Imports explícitos entre módulos, sem `@Global`](../adr/0003-imports-explicitos-entre-modulos.md)
