---
type: how-to
---

# Como integrar um serviço externo

Use este guia quando um módulo precisa chamar um fornecedor fora da aplicação, como um gateway de pagamento ou um serviço de e-mail.

## Pré-requisitos

- O caso de uso que vai chamar o fornecedor existe, ou está sendo escrito, e recebe as dependências pelo construtor ([Camadas](../reference/camadas.md#application)).
- Você sabe de onde a chamada parte: de uma requisição HTTP ou de um handler de fila. Disso depende o passo 3.
- Você sabe se a operação é idempotente no fornecedor. Uma operação que cobra ou cria algo só é idempotente com uma chave de idempotência que o fornecedor aceite.

## Passos

1. Declare o port em `application/ports/<nome>.ts`, como classe abstrata, que serve de token de injeção. Use só tipos do módulo, sem nada do SDK do fornecedor. O modelo é o `EmailSender` do notifications:

   ```ts
   export type Email = { to: string; subject: string; body: string };

   export abstract class EmailSender {
     /** Lança erro se o envio falhar; quem chama via evento deixa a outbox repetir. */
     abstract send(email: Email): Promise<void>;
   }
   ```

   Se a operação cobra ou cria algo no fornecedor, a entrada do port leva uma chave de idempotência, como o `idempotencyKey` do `ChargeInput` no `PaymentGateway` do orders. Sem ela, a chamada não pode ter retry.

2. Escreva o adapter em `infra/adapters/` ou `infra/gateways/`. Ele implementa o port, recebe a configuração pelo construtor e põe toda chamada ao fornecedor dentro do `withTimeout`, de `#shared/infra/resilience/with-timeout`. O modelo é o `SmtpEmailSender`:

   ```ts
   export type SmtpConfig = { url: string; from: string };

   const SEND_TIMEOUT_MS = 15_000;

   export class SmtpEmailSender implements EmailSender {
     private readonly transport;

     constructor(private readonly config: SmtpConfig) {
       this.transport = createTransport({ url: config.url /* e os prazos do cliente */ });
     }

     async send({ to, subject, body }: Email) {
       await withTimeout(
         () => this.transport.sendMail({ from: this.config.from, to, subject, text: body }),
         SEND_TIMEOUT_MS,
       );
     }
   }
   ```

   Se o cliente do fornecedor tem prazos próprios (conexão, socket), configure-os também. O `withTimeout` desiste de esperar, mas não cancela a chamada, que pode terminar depois no fornecedor ([Serviços externos](../explanation/servicos-externos.md#timeout-em-toda-chamada)).

3. Decida o retry e a tradução do erro pelo lugar de onde a chamada parte:
   - **De um handler de fila:** não ponha retry no adapter e deixe o erro subir. A fila do consumidor repete a entrega, com backoff. É o caso do `SmtpEmailSender`.
   - **De uma requisição HTTP:** crie um decorator em `infra/gateways/resilient-<nome>.gateway.ts`, que implementa o mesmo port, envolve o adapter e traduz qualquer falha num erro do módulo. O modelo é o `ResilientPaymentGateway` do orders:

     ```ts
     export type ResilienceOptions = { timeoutMs: number; attempts: number; baseDelayMs: number };

     export class ResilientPaymentGateway implements PaymentGateway {
       constructor(
         private readonly inner: PaymentGateway,
         private readonly opts: ResilienceOptions,
         private readonly logger: Logger,
       ) {}

       async charge(input: ChargeInput) {
         try {
           return await retry(() => withTimeout(() => this.inner.charge(input), this.opts.timeoutMs), {
             attempts: this.opts.attempts,
             baseDelayMs: this.opts.baseDelayMs,
             shouldRetry: () => true,
           });
         } catch (error) {
           // a causa só aparece aqui: o cliente recebe a mensagem genérica
           this.logger.error(
             { orderId: input.orderId, cause: error instanceof Error ? error.message : String(error) },
             'payment provider call failed',
           );
           throw new PaymentUnavailableError();
         }
       }
     }
     ```

     Cumpra estas regras:
     - **Retry só em falha transitória:** o modelo repete tudo (`shouldRetry: () => true`) porque o fornecedor simulado só falha por indisponibilidade. Com um fornecedor real, repita só o timeout, a falha de rede, o 5xx e o 429. Uma recusa definitiva, como um cartão recusado, não se repete e vira um erro 4xx próprio do módulo, e não o de indisponível.
     - **Retry só no que é idempotente:** se a operação não é idempotente, use `attempts: 1`, ou só o `withTimeout`, e mantenha a tradução do erro ([Serviços externos](../explanation/servicos-externos.md#retry-só-no-que-é-idempotente)).
     - **Erro do módulo com status 5xx:** crie o erro (`PaymentUnavailableError`, 503 no mapa do orders) seguindo [Como lançar um erro de domínio](lancar-um-erro-de-dominio.md).
     - **A causa vai para o log:** registre-a pelo port `Logger` antes de lançar o erro do módulo. O filtro de erros não loga um `DomainError` 5xx ([Respostas de erro](../reference/respostas-de-erro.md#log)).
     - **Pior caso curto:** some os prazos e as esperas de todas as tentativas. A requisição fica presa por esse tempo e, se a chamada roda dentro de uma transação, como o pagamento, a conexão do pool e o lock da linha também. O prazo de cada tentativa é o menor entre o do decorator e o `withTimeout` do adapter: some esse.

4. Se o endereço ou a credencial do fornecedor muda por ambiente, crie as variáveis ([Como adicionar uma variável de ambiente](adicionar-uma-variavel-de-ambiente.md)). Os prazos e as tentativas ficam em constantes, no adapter ou no módulo Nest.

5. Ligue o port no módulo Nest, com `useFactory`. O adapter não leva `@Injectable()`. Com variável de ambiente, injete o `ConfigService`, como o `notifications.module.ts`:

   ```ts
   {
     provide: EmailSender,
     useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
       new SmtpEmailSender({
         url: config.getOrThrow('SMTP_URL', { infer: true }),
         from: config.getOrThrow('EMAIL_FROM', { infer: true }),
       }),
     inject: [ConfigService],
   },
   ```

   Com o decorator do passo 3, monte os dois juntos, com os números ao lado, como o `orders.module.ts`:

   ```ts
   // 2 x 3s + 200ms, cerca de 6s no pior caso
   const PAYMENT_RESILIENCE = { timeoutMs: 3_000, attempts: 2, baseDelayMs: 200 };

   {
     provide: PaymentGateway,
     useFactory: (logger: Logger) =>
       new ResilientPaymentGateway(new SimulatedPaymentGateway(), PAYMENT_RESILIENCE, logger),
     inject: [Logger],
   },
   ```

   Acrescente o port ao `useFactory` e ao `inject` do caso de uso que o usa, na ordem dos parâmetros do construtor.

6. Crie o fake do port em `test/fakes/fake-<nome>.ts`, para os testes unitários de quem usa o port. Ele guarda as chamadas em vez de chamar o fornecedor, como o `FakeEmailSender`:

   ```ts
   import { Email, EmailSender } from '#modules/notifications/application/ports/email-sender';

   export class FakeEmailSender implements EmailSender {
     readonly sent: Email[] = [];

     async send(email: Email) {
       this.sent.push(email);
     }
   }
   ```

   Se os testes precisam simular o fornecedor fora do ar, dê ao fake um interruptor que lança o erro do módulo, como o `unavailable` do `FakePaymentGateway`.

7. Se você criou o decorator do passo 3, escreva o teste unitário dele ao lado, com um adapter roteirizado no lugar do de verdade e prazos de milissegundos. Cubra os casos do `resilient-payment.gateway.spec.ts`:
   - a falha transitória é repetida com a mesma entrada, inclusive a chave de idempotência;
   - a chamada que não responde estoura o prazo e é repetida;
   - esgotadas as tentativas, sai o erro do módulo;
   - a causa vai para o log, conferida com o `FakeLogger` de `#test/fakes/fake-logger`.

8. Se o fornecedor tem uma imagem Docker ou um simulador, escreva o teste de integração do adapter em `<adapter>.int-spec.ts`, com um `GenericContainer` do Testcontainers. O modelo é o `smtp-email-sender.int-spec.ts`, que confere o envio de verdade e, com o servidor fora do ar, a falha dentro do prazo.

9. Na página do módulo, em `docs/reference/modules/<módulo>.md`, acrescente o port e o adapter à tabela "Adapters", com os prazos e as tentativas.

## Como verificar

- `npm test -- <nome do spec>` passa, para o spec do decorator e para o do caso de uso que usa o fake.
- `npm run test:int -- <nome do adapter>` passa, se o passo 8 se aplica. Só precisa do Docker.
- `npm run arch` passa. Ele barra o port ou o caso de uso que importa algo da infra.
- `npm run typecheck` passa. Um fake ou um adapter que deixou de cumprir o port não compila.

## Veja também

- [Serviços externos](../explanation/servicos-externos.md): por que port e adapter, a tradução do erro, o timeout, o retry e o [circuit breaker](../explanation/servicos-externos.md#circuit-breaker-quando-houver-tráfego), que o projeto ainda não tem.
- [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados): a condição que destrava o circuit breaker e a biblioteca de resiliência.
- [Camadas](../reference/camadas.md#application): as linhas "Port", em Application, e "Adapter", em Infra.
- [Testes](../reference/testes.md#por-camada): o tipo de teste do adapter, do gateway e do adapter de fornecedor real.
