---
type: reference
---

# Respostas de erro

O formato de toda resposta de erro da API, os códigos que a base gera e como cada erro vira status HTTP. O porquê está na [ADR 0010](../adr/0010-erros-em-problem-details-com-code.md).

## Formato

Problem Details da [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457), com `Content-Type: application/problem+json`. Quem monta é o `ProblemDetailsFilter` (`src/shared/infra/http/`), registrado por `APP_FILTER` no `ProblemDetailsModule`. Nenhum módulo monta resposta de erro.

| Campo | Sempre | Valor |
| --- | --- | --- |
| `type` | Sim | `about:blank` |
| `title` | Sim | A frase do status HTTP, do `STATUS_CODES` do `node:http` (`Not Found`, `Unprocessable Entity`) |
| `status` | Sim | O status HTTP da resposta |
| `detail` | Sim | A mensagem do erro, para leitura. O cliente não decide por ela |
| `instance` | Sim | O caminho da requisição, sem a query string |
| `code` | Sim | O [código de erro](glossario.md#código-de-erro): o que o cliente usa para decidir |
| `traceId` | Não | O id do trace do span ativo. Ausente com o tracing desligado |
| `errors` | Não | Só em `VALIDATION_FAILED`: um item `{ pointer, detail }` por mensagem |

O Swagger documenta o corpo no schema `ProblemDetailsResponse`. Uma resposta de erro de uma operação entra com `@ApiProblemResponse(status, descrição)`. O 429 e o 500 entram em toda operação pelo `swagger.setup.ts`.

## Status e `code` de cada erro

| Erro | Status | `code` | `detail` |
| --- | --- | --- | --- |
| `DomainError` com status registrado | O registrado | O do erro | A mensagem do erro |
| `DomainError` sem status registrado | 422 | O do erro | A mensagem do erro |
| Validação do `ValidationPipe` | 400 | `VALIDATION_FAILED` | `Validation failed.` |
| Outra `HttpException` | O dela | O nome do status no `HttpStatus` (`NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE`). Sem nome: `HTTP_<status>` | A mensagem da exceção |
| Qualquer outro erro | 500 | `INTERNAL_ERROR` | `An unexpected error occurred.`, nunca a mensagem interna |

Fora do contexto HTTP (fila, job), o filtro relança o erro.

O `/health/live` e o `/health/ready` ficam fora do formato: o 503 deles é o corpo do Terminus, com os indicadores ([Operação](operacao.md#health)).

## Registro de status

Cada módulo declara o status dos seus códigos em `infra/http/error-statuses.ts` (`<MÓDULO>_ERROR_STATUSES`) e o registra nos `providers` do Nest module com `provideErrorStatuses(...)`. O `ErrorStatusRegistry` guarda os mapas de todos os módulos.

| Regra | Detalhe |
| --- | --- |
| Mesmo `code` com dois status | A app não sobe: o erro cita o `code` e os dois status |
| Mesmo `code` com o mesmo status | Aceito |
| `code` fora de todo mapa | Responde 422 e gera um `warn` com o `code` |
| Códigos do `shared` | `CONCURRENCY_CONFLICT` (409), `INVALID_MONEY` e `CURRENCY_MISMATCH` (422), registrados pelo `ProblemDetailsModule`. Os módulos não os repetem |

Os mapas de cada módulo estão na página dele em [Módulos](../README.md#módulos).

## Validação

O `ValidationPipe` global usa `errorFormat: 'grouped'`, e o filtro converte cada mensagem num item de `errors`. O `pointer` é um JSON Pointer em forma de fragmento: cada segmento do caminho com ponto vira um segmento (`items.0.quantity` → `#/items/0/quantity`), com `~` e `/` escapados como `~0` e `~1`.

O pointer aponta para o objeto que o DTO valida: o corpo, ou a query num DTO de `@Query()` (`GET /v1/orders?limit=0` dá `#/limit`). Ele é remontado do caminho que o `ValidationPipe` junta com ponto, então um campo cujo nome tem ponto (`a.b`) sai como dois segmentos (`#/a/b`).

Quando as mensagens passam do `maxErrorMessagesLength` do Nest, o último item é `{ detail: 'Further validation errors were omitted' }`, sem `pointer`.

## Log

| Erro | Log |
| --- | --- |
| 500 inesperado e `HttpException` 5xx | `error` pelo port `Logger`, com `err` (stack), `method` e `path` |
| `DomainError` 5xx, como o `PAYMENT_UNAVAILABLE` | Nenhum: o adapter que o lança já loga a causa |
| `DomainError` sem status registrado | `warn` com o `code` |
| Outro 4xx | Nenhum: o log de acesso já mostra o status |

## Exemplos

Erro de domínio (`POST /v1/orders/:id/pay` num pedido já pago):

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "Order is already paid",
  "instance": "/v1/orders/0190a000-0000-7000-8000-000000000000/pay",
  "code": "ORDER_ALREADY_PAID",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

Validação (`POST /v1/orders` com quantidade zero e um campo a mais):

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Validation failed.",
  "instance": "/v1/orders",
  "code": "VALIDATION_FAILED",
  "errors": [
    { "pointer": "#/items/0/qty", "detail": "qty must not be less than 1" },
    { "pointer": "#/extra", "detail": "property extra should not exist" }
  ]
}
```

`HttpException` (`GET /v1/products/:id` com um id inexistente):

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Product not found",
  "instance": "/v1/products/0190a000-0000-7000-8000-000000000000",
  "code": "NOT_FOUND"
}
```

Erro inesperado:

```json
{
  "type": "about:blank",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred.",
  "instance": "/v1/orders",
  "code": "INTERNAL_ERROR"
}
```
