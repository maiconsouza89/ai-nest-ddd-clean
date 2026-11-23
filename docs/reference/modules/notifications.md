---
type: reference
---

# Módulo notifications

Avisos ao cliente disparados por eventos de outros módulos.

Código em `src/modules/notifications/`, registrado no `src/app.module.ts` como `NotificationsModule`.

O módulo não tem `domain/` nem tabelas: só reage a eventos. A lógica fica em `application/`, e os adapters e o handler em `infra/`.

## Linguagem ubíqua

| Termo | No código | Significado |
| --- | --- | --- |
| Destinatário | `RecipientDirectory` | O e-mail do cliente do pedido, lido do identity pelo `customerId`. |
| E-mail | `Email` (`to`, `subject`, `body`), `EmailSender` | A mensagem enviada. Não é o value object `Email` do identity. |
| E-mail de pagamento confirmado | `SendOrderPaidEmailUseCase` | O aviso enviado quando um pedido é pago. |

## Contrato público

- **Facade:** nenhuma. Nenhum módulo chama o notifications.
- **HTTP:** nenhuma rota.

## Eventos publicados

Nenhum.

## Eventos consumidos

| Evento | Publicado por | Consumidor | Efeito |
| --- | --- | --- | --- |
| `orders.order-paid` v1 | [orders](orders.md#eventos-publicados) | `notifications.email-on-order-paid` (`OnOrderPaidHandler`) | Envia "Pagamento confirmado: pedido `<orderId>`", com o total em `<moeda> <valor>` |

- O handler passa pelo `IdempotentConsumer`: uma entrega repetida depois de um processamento confirmado não envia de novo. O envio fica fora do banco, então uma falha entre o envio e o commit reenvia o e-mail na nova tentativa.
- Ele importa só o tipo do evento, não o módulo de orders.
- Cliente sem usuário (apagado) não recebe e-mail. O caso registra um aviso no log e termina sem erro, para a fila não repetir.
- Uma falha no envio lança erro, e a fila reentrega o evento.

## Invariantes

Nenhuma regra de domínio.

## Dependências

| Módulo | Facade | Port do notifications | Uso |
| --- | --- | --- | --- |
| [identity](identity.md) | `UserDirectoryFacade.emailOf` | `RecipientDirectory` (`IdentityRecipientDirectory`) | E-mail do cliente |

| Port | Adapter |
| --- | --- |
| `EmailSender` | `LoggingEmailSender`: simulado, só registra o assunto no log, sem o endereço |

## Schema e migrations

Nenhum schema próprio. A marca de evento processado fica na tabela `shared.processed_events`, do shared (`npm run mig:outbox:run`).

## Decisões

- [ADR 0003](../../adr/0003-imports-explicitos-entre-modulos.md): o notifications importa o `IdentityModule` para usar a facade dele.
