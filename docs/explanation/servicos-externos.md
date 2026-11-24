---
type: explanation
---

# Serviços externos

Por que cada serviço de fora do processo entra por um port, por que o adapter traduz os erros do fornecedor, e por que a resiliência da chamada fica num decorator com timeout e retry. Os ports e adapters de cada módulo estão em [Camadas](../reference/camadas.md#application).

## Contexto

O projeto fala com dois fornecedores: o de pagamento do orders, simulado (`SimulatedPaymentGateway`, que aprova tudo), e o de e-mail do notifications, um servidor SMTP de verdade (`SmtpEmailSender`). Em desenvolvimento, o SMTP é o Mailpit do `docker-compose.yml`, que guarda os e-mails sem enviá-los para fora. Um fornecedor real pode demorar, cair, responder com erro no formato dele ou mudar de API. Nada disso pode vazar para o domínio nem travar a aplicação.

## Por quê

### Port na application, adapter na infra

O caso de uso declara o que precisa num port (`PaymentGateway`, `EmailSender`), e a infra o implementa com um adapter. Três ganhos:

- **Teste sem rede:** o caso de uso é testado com um fake, sem fornecedor nem chave de API.
- **Troca de fornecedor:** integrar um fornecedor de pagamento de verdade é escrever outro adapter e trocar a ligação no módulo Nest. O caso de uso não muda.
- **Desenvolvimento local:** o adapter simulado do pagamento e o Mailpit no lugar de um provedor de e-mail deixam rodar o fluxo inteiro sem conta em fornecedor nenhum.

### O adapter traduz o erro

O SDK de um fornecedor lança erros no formato dele: códigos HTTP, classes próprias, mensagens que mudam de versão para versão. O adapter os converte num erro do módulo. No pagamento, qualquer falha do fornecedor, inclusive o timeout, vira `PaymentUnavailableError`, que o filter do orders responde como 503. O caso de uso e o filter conhecem um erro só, e a causa real vai para o log, sem chegar ao cliente.

### Resiliência num decorator

A resiliência do pagamento fica no `ResilientPaymentGateway`, um decorator que implementa o mesmo port e envolve o adapter. O módulo Nest monta os dois juntos:

```ts
// 2 x 3s + 200ms, cerca de 6s no pior caso
const PAYMENT_RESILIENCE = { timeoutMs: 3_000, attempts: 2, baseDelayMs: 200 };

{
  provide: PaymentGateway,
  useFactory: (logger: Logger) =>
    new ResilientPaymentGateway(new SimulatedPaymentGateway(), PAYMENT_RESILIENCE, logger),
  inject: [Logger],
}
```

O adapter de um fornecedor real só traduz chamadas e erros, e a política de timeout e retry fica visível num lugar, com os números ao lado. Trocar de fornecedor não mexe nela. As duas funções que a implementam, `withTimeout` e `retry`, ficam no `shared/infra/resilience/`, porque a regra delas não depende de módulo.

### Timeout em toda chamada

Sem timeout, um fornecedor lento prende a requisição, a conexão com o banco e, no pagamento, a trava da linha do pedido, que fica aberta durante a cobrança ([Consistência e eventos](consistencia-e-eventos.md#trava-pessimista-quando-o-efeito-não-se-desfaz)). Algumas requisições lentas ao mesmo tempo esgotam o pool de conexões e derrubam a API inteira. Por isso o pior caso do pagamento é curto de propósito, cerca de 6 segundos.

O `withTimeout` desiste de esperar, mas não cancela a chamada, que pode terminar depois, do lado do fornecedor. No pagamento, isso é seguro pelo mesmo motivo do retry.

O e-mail não passa por um decorator: o `SmtpEmailSender` usa os prazos de cada fase do Nodemailer (conexão, saudação e socket parado, que por padrão chegam a 10 minutos) e um `withTimeout` no envio inteiro. Sem retry, sobra só o timeout, e ele cabe no adapter.

### Retry só no que é idempotente

Repetir uma chamada que falhou pode repetir o efeito. Uma cobrança que deu timeout pode ter sido feita, e cobrar de novo cobraria duas vezes. O pagamento pode ter retry porque toda chamada leva a chave de idempotência `pay:<orderId>`: o fornecedor devolve o mesmo pagamento para a mesma chave, em vez de cobrar de novo. Sem essa chave, o certo seria não repetir.

O retry espera entre as tentativas, e a espera dobra a cada uma (backoff exponencial). Um fornecedor sobrecarregado não recebe uma rajada de repetições na hora em que menos aguenta.

O e-mail não tem retry no adapter. Ele roda num consumidor de evento, e se o envio falhar, a fila do consumidor tenta de novo, com backoff ([Consistência e eventos](consistencia-e-eventos.md#uma-fila-por-consumidor)). Um retry no adapter se somaria ao da fila. O preço é o que a página de consistência já registra: um e-mail pode sair duas vezes.

### Circuit breaker, quando houver tráfego

Com um fornecedor fora do ar, cada requisição ainda gasta o timeout inteiro antes de falhar. Um circuit breaker (por exemplo, o `opossum`) conta as falhas e, passado um limite, para de chamar por um tempo e falha na hora. O projeto não usa um: o pagamento é simulado, o e-mail roda fora da requisição, num consumidor de evento, e o timeout curto já limita o estrago. Ele faz sentido com um fornecedor real instável e tráfego suficiente para que vários segundos de timeout por requisição esgotem o pool ([Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados)).

## Alternativas e trade-offs

- **Resiliência dentro de cada adapter:** um arquivo a menos por fornecedor. Em troca, a política se mistura com a tradução de chamadas, se repete em cada adapter e é perdida numa troca de fornecedor.
- **Retry no caso de uso:** o caso de uso saberia que a chamada falhou e poderia decidir o que fazer. Em troca, ele passaria a conhecer timeout e backoff, que são detalhe de infraestrutura, e cada caso de uso repetiria o laço.
- **Uma biblioteca de resiliência (`cockatiel`, `opossum`):** timeout, retry, circuit breaker e bulkhead prontos e combináveis. O projeto precisa só de timeout e retry, que cabem em duas funções curtas e testadas. A biblioteca entra junto com o circuit breaker.
- **Lançar o erro do fornecedor:** dispensa a tradução. Em troca, o filter teria de conhecer cada SDK, e trocar de fornecedor mudaria as respostas da API.

## Decisões relacionadas

Nenhum ADR trata deste tema. A separação entre port e adapter segue a [regra de dependência](arquitetura.md#as-dependências-apontam-para-dentro).
