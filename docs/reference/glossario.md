---
type: reference
---

# Glossário

Os termos que atravessam os módulos, os termos com sentidos diferentes conforme o módulo e um índice de todos os termos da linguagem ubíqua. Os termos de um módulo só são definidos na página dele, em `docs/reference/modules/`.

## Termos compartilhados

### Usuário, ator e cliente

Três conceitos diferentes, que podem apontar para a mesma pessoa:

| Termo | No código | Dono | O que é |
| --- | --- | --- | --- |
| Usuário | `User` | [identity](modules/identity.md#linguagem-ubíqua) | A conta cadastrada: e-mail, nome, senha e roles |
| Ator | `Actor` | shared | Quem faz a requisição em curso: id e roles, carregados do banco a cada requisição |
| Cliente | `customerId` | [orders](modules/orders.md#linguagem-ubíqua) | O dono do pedido: o id do usuário que o criou |

Os três usam o mesmo id, mas não se confundem. Quando um admin cancela o pedido de outro usuário, o ator é o admin, e o cliente continua sendo o dono do pedido. O pedido não muda de cliente, e o e-mail de pagamento vai para o cliente, não para o ator.

### Agregado

Um grupo de objetos de domínio salvo e alterado como uma unidade, com uma raiz que garante as regras dele. Outro agregado o referencia só pelo id. Exemplo: o `Order`, com os seus `OrderItem`.

### Evento de domínio

Um fato que um agregado anota quando o estado muda, como `OrderPaid`. Fica dentro do módulo e não sai do processo. O caso de uso converte cada um num evento de integração.

### Evento de integração

O contrato público de um fato, como `orders.order-paid`. Tem `eventId`, `type`, `version`, `occurredAt` e um `payload` só com primitivos. Mudança compatível acrescenta campos. Mudança que quebra cria uma versão nova (`V2`). Cada evento tem um exemplo versionado em `contracts/events/`.

### Outbox

A tabela onde o caso de uso grava os eventos de integração, na mesma transação do agregado. O evento só sai se a gravação confirmar, e um worker o entrega depois a cada consumidor, com nova tentativa em caso de falha. A entrega é "pelo menos uma vez".

### Consumidor

Um handler de outro módulo, ou do próprio, que assina eventos de integração por tipo. Tem um nome no formato `<módulo>.<efeito>`, como `inventory.release-on-order-cancelled`, e uma fila própria.

### Consumidor idempotente

Um consumidor que produz o efeito uma vez só, mesmo que a outbox entregue o evento de novo. Ele marca o par `eventId` e consumidor na mesma transação do efeito (`IdempotentConsumer`). Um efeito que pode se repetir sem dano dispensa a marca.

### Idempotency key

O cabeçalho `Idempotency-Key` que o cliente HTTP envia para repetir uma requisição sem repetir o efeito. A mesma chave, do mesmo ator, para a mesma requisição, devolve a mesma resposta. Para outra requisição, é recusada. Usada no pagamento do [orders](modules/orders.md#invariantes).

### Facade

A única porta de entrada síncrona de um módulo para os outros, em `contracts/`. Recebe e devolve só primitivos e não expõe o domínio. Exemplos: `CatalogFacade`, `InventoryFacade`, `UserDirectoryFacade`.

### Port e adapter

O port é uma classe abstrata que a `application/` define com o que precisa de fora, como `PriceCatalog` ou `PaymentGateway`. O adapter, na `infra/`, implementa o port com uma tecnologia ou com a facade de outro módulo. Um adapter que chama outro módulo ou um serviço externo também é chamado de gateway.

### Contrato

Tudo o que um módulo expõe aos outros: as facades e os eventos de integração, em `contracts/`. Um módulo importa só o `contracts/` de outro e, no arquivo do Nest module, o Nest module dele, para declarar a dependência em `imports`. O `.dependency-cruiser.js` permite esse segundo import de propósito, na regra `modulo-nest-so-importa-modulo-nest`.

### Shared kernel

O código comum a todos os módulos, em `src/shared/`: tipos de base (`AggregateRoot`, `DomainError`, `Money`, `Actor`), ports de infraestrutura (transação, outbox, relógio, ids, log) e a infraestrutura transversal. Não tem regra de negócio de nenhum módulo.

### Dinheiro

O value object `Money`: um inteiro em centavos e uma moeda, `BRL` por padrão. Somar moedas diferentes dá `CURRENCY_MISMATCH`, e um valor que não é inteiro dá `INVALID_MONEY`.

### Concorrência otimista

Um agregado com a coluna `version`, como o `Order` e os gerados pelo `plop module`, guarda a versão lida. A gravação confere se ela não mudou. Se outra requisição gravou antes, a segunda falha com `CONCURRENCY_CONFLICT` e precisa reler.

## Mesmo termo, sentidos diferentes

| Termo | Sentido | Onde vale |
| --- | --- | --- |
| E-mail | Value object com o endereço normalizado da conta (`Email`) | [identity](modules/identity.md#linguagem-ubíqua) |
| E-mail | A mensagem enviada: destinatário, assunto e corpo (`Email`) | [notifications](modules/notifications.md#linguagem-ubíqua) |

## Índice

| Termo | Definição |
| --- | --- |
| Access token | [identity](modules/identity.md#linguagem-ubíqua) |
| Agregado | [Agregado](#agregado) |
| Ator | [Usuário, ator e cliente](#usuário-ator-e-cliente) |
| Cancelar | [orders](modules/orders.md#linguagem-ubíqua) |
| Chave de idempotência | [Idempotency key](#idempotency-key) |
| Código de verificação | [identity](modules/identity.md#linguagem-ubíqua) |
| Cliente | [Usuário, ator e cliente](#usuário-ator-e-cliente) |
| Concorrência otimista | [Concorrência otimista](#concorrência-otimista) |
| Consultar (pedido) | [orders](modules/orders.md#linguagem-ubíqua) |
| Consumidor | [Consumidor](#consumidor) |
| Consumidor idempotente | [Consumidor idempotente](#consumidor-idempotente) |
| Contrato | [Contrato](#contrato) |
| Criar (pedido) | [orders](modules/orders.md#linguagem-ubíqua) |
| Destinatário | [notifications](modules/notifications.md#linguagem-ubíqua) |
| Dinheiro | [Dinheiro](#dinheiro) |
| E-mail | [Mesmo termo, sentidos diferentes](#mesmo-termo-sentidos-diferentes) |
| E-mail de boas-vindas | [notifications](modules/notifications.md#linguagem-ubíqua) |
| E-mail de código de verificação | [notifications](modules/notifications.md#linguagem-ubíqua) |
| E-mail de pagamento confirmado | [notifications](modules/notifications.md#linguagem-ubíqua) |
| Evento de domínio | [Evento de domínio](#evento-de-domínio) |
| Evento de integração | [Evento de integração](#evento-de-integração) |
| Expirar | [orders](modules/orders.md#linguagem-ubíqua) |
| Facade | [Facade](#facade) |
| Fechar | [orders](modules/orders.md#linguagem-ubíqua) |
| Item do pedido | [orders](modules/orders.md#linguagem-ubíqua) |
| Liberar | [inventory](modules/inventory.md#linguagem-ubíqua) |
| Outbox | [Outbox](#outbox) |
| Pagar | [orders](modules/orders.md#linguagem-ubíqua) |
| Pedido | [orders](modules/orders.md#linguagem-ubíqua) |
| Port e adapter | [Port e adapter](#port-e-adapter) |
| Preço | [catalog](modules/catalog.md#linguagem-ubíqua) |
| Preço do produto | [catalog](modules/catalog.md#linguagem-ubíqua) |
| Produto | [catalog](modules/catalog.md#linguagem-ubíqua) |
| Referência | [inventory](modules/inventory.md#linguagem-ubíqua) |
| Refresh token | [identity](modules/identity.md#linguagem-ubíqua) |
| Registrar | [identity](modules/identity.md#linguagem-ubíqua) |
| Reserva | [inventory](modules/inventory.md#linguagem-ubíqua) |
| Reservar | [inventory](modules/inventory.md#linguagem-ubíqua) |
| Role | [identity](modules/identity.md#linguagem-ubíqua) |
| Saldo | [inventory](modules/inventory.md#linguagem-ubíqua) |
| Sessão | [identity](modules/identity.md#linguagem-ubíqua) |
| Shared kernel | [Shared kernel](#shared-kernel) |
| Status (do pedido) | [orders](modules/orders.md#linguagem-ubíqua) |
| Total | [orders](modules/orders.md#linguagem-ubíqua) |
| Usuário | [Usuário, ator e cliente](#usuário-ator-e-cliente) |
| Verificar o e-mail | [identity](modules/identity.md#linguagem-ubíqua) |
