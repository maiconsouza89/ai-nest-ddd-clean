---
type: explanation
---

# Autenticação e ownership

Por que a autenticação fica na infra e o ownership no caso de uso, por que a sessão vive num refresh token rotativo, e por que o e-mail é verificado e o login limitado por conta. Rotas, prazos e respostas estão em [Autenticação](../reference/autenticacao.md). A decisão de carregar o ator a cada requisição está na [ADR 0002](../adr/0002-ator-carregado-por-requisicao.md).

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

Um access token não pode ser revogado antes de vencer, então a validade dele é curta. A sessão longa vive no refresh token, que pode ser revogado porque está no banco.

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

### O e-mail é verificado antes do primeiro login

O register cria a conta com o e-mail por verificar, e o login recusa a conta até lá. Sem isso, qualquer um abriria uma conta com o e-mail de outra pessoa, e os avisos dela iriam para quem é dono do endereço. Por que o notifications envia o código, e o preço de levá-lo no evento, está na [ADR 0009](../adr/0009-verificacao-de-email-com-codigo-no-evento.md). Prazos e limites estão em [Autenticação](../reference/autenticacao.md#código-de-verificação).

- **O código é curto, então o limite é o que protege.** Seis dígitos têm um milhão de valores: o hash no banco não resiste a força bruta. O que protege é o prazo curto e o limite de tentativas erradas por código. Cada reenvio traz um código novo com mais tentativas, então o número de códigos por conta também é limitado, e o total de palpites por dia fica abaixo do teto do [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html). O rate limit da verificação é só por IP, sem o limite por conta do login, e não segura quem distribui os pedidos.
- **O e-mail do código não leva texto do cadastro.** Quem se cadastra com o e-mail de outra pessoa escolhe o nome, e um nome como "acesse http://..." chegaria à vítima num e-mail legítimo ([content spoofing](https://community.owasp.org/attacks/Content_Spoofing)). O nome só aparece nas boas-vindas, que saem depois de o dono do endereço provar o acesso.
- **A contagem das tentativas não pode correr.** Dez tentativas simultâneas que leiam o mesmo `attempts` virariam dez palpites com uma tentativa contada. O caso de uso trava a linha do código, e as tentativas entram uma depois da outra. O erro sai depois da transação, como na renovação: lançado dentro dela, desfaria a contagem.
- **As respostas não revelam a conta.** O login confere a senha antes de dizer que o e-mail não foi verificado. A verificação dá o mesmo erro para e-mail desconhecido e código errado, e o reenvio responde 202 sempre.

### O login também é limitado por conta

O limite por IP do login não segura quem distribui as tentativas contra uma conta só por muitos IPs, numa força bruta ou num password spraying. Por isso o login tem um segundo limite, chaveado pelo e-mail normalizado pela mesma regra do `LoginUseCase`, e somado ao do IP. Uma requisição passa só se couber nos dois.

- **O que fica de fora: credential stuffing.** No stuffing, cada par vazado de e-mail e senha é tentado uma vez, em contas diferentes, e nenhum contador por conta passa de 1. A defesa contra ele é outra, MFA ou checagem de senha vazada ([Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#código-e-dependências)).
- **Atraso crescente em dois degraus, sem bloqueio duro.** Um degrau curto segura a rajada, e um degrau de uma hora limita o total de palpites por dia, e todo bloqueio vence sozinho. Os números estão em [Operação](../reference/operacao.md#rate-limit). O preço: passando do limite da hora, um atacante trava o login da vítima até a janela vencer, mesmo com a senha certa, e pode renovar o bloqueio enquanto mantiver o ataque ([gatilho em Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#código-e-dependências)).
- **Toda tentativa conta, e não só as falhas.** O limite é do `@nestjs/throttler`, como o do IP, e o guard roda antes do caso de uso, sem saber o resultado. Um login certo também gasta a cota, e um usuário legítimo raramente chega ao limite.
- **O limite não revela a conta.** O throttler guarda a chave com hash SHA-256, e o e-mail não fica em texto puro no Redis. O hash não tem segredo: quem lê o Redis e tem um e-mail candidato confirma se houve tentativa contra ele. O contador vale para qualquer e-mail, cadastrado ou não, e o 429 sai igual nos dois casos: o limite não diz se a conta existe.
- **Opt-in pela rota.** Os limites globais do throttler valem em toda rota com o guard, então os da conta se pulam onde a rota não os pede. O `shared` não sabe o que é a chave: a função que a tira do corpo vem do identity. O registro, a verificação e a renovação não ganham limite por conta: a verificação e o reenvio já limitam por conta no domínio, o refresh token não se adivinha e o registro não tem senha a adivinhar.

### Ownership no caso de uso

A entidade sabe quem é o dono, guardando só o id dele, sem FK para o `identity`. O caso de uso decide se o ator pode agir, com uma regra só para as ações e para a leitura de um pedido:

```ts
// orders/application/order-access.ts
export function assertCanAccessOrder(actor: Actor, customerId: string) {
  const isAdmin = actor.roles.includes('admin');
  if (customerId !== actor.id && !isAdmin) throw new NotOrderOwnerError();
}
```

As ações carregam o agregado pelo repositório e chamam a regra com o `customerId` dele. A leitura de um pedido chama a mesma regra com o `customerId` que a query devolve.

Um guard não resolveria isso: ele vê a rota e o token, mas não o pedido. A regra "o dono ou um admin" é de negócio, e o teste dela é um teste unitário do caso de uso, sem HTTP.

O `@Roles('admin')` e o `RolesGuard` ficam para o caso simples, em que a rota inteira é de uma role, sem olhar o recurso. Numa listagem, o filtro pelo ator vai na query (`listByCustomer(actor.id, page)`), e não num filtro depois de carregar tudo.

## Alternativas e trade-offs

- **403 ou 404 para quem não é o dono:** o orders responde 403 (`NOT_ORDER_OWNER`), que diz a verdade e facilita o diagnóstico. Em troca, revela que o pedido existe. Responder 404 esconderia a existência, ao custo de um erro menos claro para quem chama.
- **`@nestjs/authentication` e `@nestjs/authorization`:** a documentação do Nest apresenta esses pacotes, com guard global, `@Public()`, `@CurrentUser()`, refresh token de uso único e um guard de autorização que nega por padrão (`@Can()`). Estão na 0.1.x, e o projeto fica com o guard próprio sobre o `@nestjs/jwt` até a 1.0 ([ADR 0002](../adr/0002-ator-carregado-por-requisicao.md), [gatilho em Evoluções com gatilho](../reference/evolucoes-com-gatilho.md)). Se adotar, o `validate()` do provider fica no `identity`, e o controller continua convertendo o usuário em `Actor` antes de chamar o caso de uso.
- **Contar só as falhas do login, num port do caso de uso:** um `LoginAttemptLimiter` contaria as senhas erradas e zeraria o contador no sucesso, como a OWASP descreve o bloqueio de conta. Seria um segundo mecanismo de rate limit, com 429 e `Retry-After` próprios, ao lado do throttler. O projeto preferiu contar toda tentativa no mesmo throttler.
- **Atraso exponencial de verdade:** dobrar a espera a cada falha pediria um script Lua próprio no `RedisThrottlerStorage`. Os dois degraus dão o atraso crescente com o throttler como ele é.
- **Janela de tolerância na renovação:** aceitar o token anterior por alguns segundos depois da troca salvaria o cliente que repete a renovação. Em troca, um token roubado usado dentro da janela passaria sem revogar a família. O projeto preferiu a detecção de reuso sem exceção.

## Decisões relacionadas

- [ADR 0002: Ator carregado a cada requisição](../adr/0002-ator-carregado-por-requisicao.md)
- [ADR 0003: Imports explícitos entre módulos, sem `@Global`](../adr/0003-imports-explicitos-entre-modulos.md)
- [ADR 0009: Verificação do e-mail com o código no evento](../adr/0009-verificacao-de-email-com-codigo-no-evento.md)
