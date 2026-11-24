---
type: reference
---

# Módulo notifications

E-mails ao usuário disparados por eventos de outros módulos: o código de verificação e as boas-vindas, do identity, e, como exemplo removível, a confirmação de pagamento, do orders.

Código em `src/modules/notifications/`, registrado no `src/app.module.ts` como `NotificationsModule`.

O módulo não tem `domain/` nem tabelas: só reage a eventos. A lógica fica em `application/`, e os adapters e o handler em `infra/`.

## Linguagem ubíqua

| Termo | No código | Significado |
| --- | --- | --- |
| Destinatário | `RecipientDirectory` | O e-mail do cliente do pedido, lido do identity pelo `customerId`. Só o e-mail de pagamento confirmado o usa: os eventos do identity já trazem o endereço no payload. |
| E-mail | `Email` (`to`, `subject`, `body`), `EmailSender` | A mensagem enviada. Não é o value object `Email` do identity. |
| E-mail de código de verificação | `SendVerificationCodeEmailUseCase` | "Seu código de verificação": o código e a validade em minutos, enviado no register e em cada reenvio. Não leva o nome do cadastro: o endereço ainda não foi verificado, e o nome poderia ser de quem usou o e-mail de outra pessoa. |
| E-mail de boas-vindas | `SendWelcomeEmailUseCase` | "Boas-vindas, `<nome>`": enviado quando o usuário verifica o e-mail. |
| E-mail de pagamento confirmado | `SendOrderPaidEmailUseCase` | O aviso enviado quando um pedido é pago. Exemplo, sai junto com o orders. |

## Contrato público

- **Facade:** nenhuma. Nenhum módulo chama o notifications.
- **HTTP:** nenhuma rota.

## Eventos publicados

Nenhum.

## Eventos consumidos

| Evento | Publicado por | Consumidor | Efeito |
| --- | --- | --- | --- |
| `identity.verification-code-issued` v1 | [identity](identity.md#eventos-publicados) | `notifications.email-on-verification-code-issued` (`OnVerificationCodeIssuedHandler`) | Envia "Seu código de verificação" ao `email` do payload, com o código e a validade, de `occurredAt` a `expiresAt`, em minutos. Ignora o `name` |
| `identity.email-verified` v1 | [identity](identity.md#eventos-publicados) | `notifications.email-on-email-verified` (`OnEmailVerifiedHandler`) | Envia "Boas-vindas, `<nome>`" ao `email` do payload |
| `orders.order-paid` v1 | [orders](orders.md#eventos-publicados) | `notifications.email-on-order-paid` (`OnOrderPaidHandler`) | Exemplo. Envia "Pagamento confirmado: pedido `<orderId>`", com o total em `<moeda> <valor>` |

- Os handlers passam pelo `IdempotentConsumer`: uma entrega repetida depois de um processamento confirmado não envia de novo. O envio fica fora do banco, então uma falha entre o envio e o commit reenvia o e-mail na nova tentativa.
- Eles importam só o tipo do evento, não o módulo que o publica. Os testes do lado do consumidor (`identity-email.handlers.spec.ts` e `on-order-paid.handler.spec.ts`) usam os exemplos versionados dos contratos.
- No pedido pago, cliente sem usuário (apagado) não recebe e-mail. O caso registra um aviso no log e termina sem erro, para a fila não repetir.
- Uma falha no envio lança erro, e a fila reentrega o evento.

## Invariantes

Nenhuma regra de domínio.

## Dependências

| Módulo | Facade | Port do notifications | Uso |
| --- | --- | --- | --- |
| [identity](identity.md) | `UserDirectoryFacade.emailOf` | `RecipientDirectory` (`IdentityRecipientDirectory`) | E-mail do cliente do pedido pago. Sai junto com o exemplo |

| Port | Adapter |
| --- | --- |
| `EmailSender` | `SmtpEmailSender` (Nodemailer), em todos os ambientes, com `SMTP_URL` e `EMAIL_FROM`. Em desenvolvimento e no e2e, o servidor é o Mailpit do `docker-compose.yml`. Os testes unitários usam o `FakeEmailSender` de `test/fakes/` |

- O `SmtpEmailSender` tem prazo por fase do Nodemailer (5 s para conectar e para a saudação, 10 s de socket parado) e 15 s para o envio inteiro. Sem retry próprio: uma falha lança erro, e a fila do consumidor entrega o evento de novo ([Serviços externos](../../explanation/servicos-externos.md#resiliência-num-decorator)).
- O envio roda dentro da transação que o `IdempotentConsumer` abre para gravar a marca de processado. Um SMTP lento segura uma conexão do Postgres por até 15 s por tentativa, e um envio que estoura o prazo pode chegar mesmo assim e ser repetido na nova tentativa.
- O e-mail sai só em texto puro.

## Schema e migrations

Nenhum schema próprio. A marca de evento processado fica na tabela `shared.processed_events`, do shared (`npm run mig:outbox:run`).

## Decisões

- [ADR 0003](../../adr/0003-imports-explicitos-entre-modulos.md): o notifications importa o `IdentityModule` para usar a facade dele.
