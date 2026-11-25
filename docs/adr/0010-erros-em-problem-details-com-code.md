---
status: accepted
---

# Respostas de erro em Problem Details, com `type` `about:blank` e um `code`

Toda resposta de erro da API segue o Problem Details da RFC 9457 (`Content-Type: application/problem+json`), montada por um filtro global no `shared`. O `type` é sempre `about:blank`, e o `title` é a frase do status HTTP, como a RFC pede para esse `type`. O que identifica o problema para o cliente é a extensão `code`, o [código de erro](../reference/glossario.md#código-de-erro) (`ORDER_ALREADY_PAID`, `VALIDATION_FAILED`, `INTERNAL_ERROR`). Toda resposta tem um, seja o erro de domínio, de validação, uma `HttpException` ou um erro inesperado.

Cada módulo registra o status de cada código dele num registro global, e a app não sobe se dois módulos derem status diferentes ao mesmo código. Um código fora do registro responde 422 e gera um `warn` no log. Os erros de validação vão na extensão `errors`, um item por mensagem, com `pointer` (JSON Pointer) e `detail`. O `instance` é o caminho da requisição, e a extensão `traceId` liga a resposta ao trace.

A RFC avisa que trocar o `type` depois de publicado quebra o cliente. Esta decisão fixa o `code` como o identificador do contrato, e não o `type`.

## Considered Options

- **Uma URI por tipo de problema (`https://<domínio>/problems/order-already-paid`):** é o que a RFC incentiva, com uma página de documentação em cada URI. Um template não tem domínio próprio. Cada projeto derivado teria de trocar todas as URIs, e a troca quebraria o contrato. Manter as páginas no ar também é custo.
- **URI relativa que não resolve (`/problems/order-already-paid`), como nas diretrizes da Zalando:** dispensa o domínio e deixa o `type` como identificador, sem `code`. Só que a RFC recomenda URI absoluta, e o `code` já existe no domínio e nos testes. Ter as duas coisas seria redundante, e ter só a URI seria uma tradução a mais entre o domínio e o HTTP.
- **Manter o `{ code, message }` com um filtro por módulo:** não exige mudança, mas deixa três formatos de erro na API (domínio, validação do Nest e o 500 padrão) e repete o filtro em cada módulo.
- **O status HTTP na classe do erro de domínio:** dispensa o registro, mas põe HTTP no domínio e quebra as [camadas](../reference/camadas.md).

## Consequences

- O cliente trata um formato só e decide pelo `code`. O `detail` é para leitura, e a RFC diz que o cliente não deve interpretá-lo.
- O campo `message` saiu da resposta, e o `detail` entrou no lugar dele, sem período de compatibilidade.
- Um módulo novo não escreve filtro: o `plop module` gera o mapa de status e o registro dele.
- Se um projeto derivado quiser `type` próprios, a troca é uma quebra de contrato, e o `code` pode continuar ao lado para a transição.
- O 500 responde uma mensagem genérica e vai para o log com a stack. A resposta nunca mostra a mensagem interna.
