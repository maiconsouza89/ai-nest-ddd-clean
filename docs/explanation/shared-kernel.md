---
type: explanation
---

# Shared kernel

Por que o `src/shared/` guarda só blocos técnicos e por que, na dúvida, um tipo fica duplicado em cada módulo. O que vai para o `shared` e o que fica no módulo está em [Camadas](../reference/camadas.md#shared).

## Contexto

Alguns blocos têm a mesma regra em qualquer módulo: a raiz de agregado (`AggregateRoot`) e o evento de domínio (`DomainEvent`), a base dos erros de domínio (`DomainError`) e o conflito de versão (`ConcurrencyError`), o dinheiro (`Money`, com os erros dele no próprio `money.vo.ts`), o ator da requisição (`Actor`), a página (`Page`), o evento de integração (`IntegrationEvent`) e o consumidor idempotente (`IdempotentConsumer`). Também os ports de relógio, ids, transação e log, e os da entrega de eventos e da autenticação (`Outbox`, `EventPublisher`, `ProcessedEvents` e `ActorResolver`). O `src/shared/testing/` guarda um teste da toolchain: confere que a decorator metadata chega ao Nest e que a injeção por classe funciona nos testes. Reescrevê-los em cada módulo seria repetir a mesma regra cinco vezes, com o risco de as cópias divergirem. Eles ficam no [shared kernel](../reference/glossario.md#shared-kernel), em `src/shared/`, que segue as mesmas camadas de um módulo (`domain/`, `application/`, `infra/`) e não importa nada de `src/modules/`.

## Por quê

### Pequeno e estável, porque todo módulo depende dele

Uma mudança no `shared` atinge todos os módulos de uma vez. Por isso ele guarda só o que tem a mesma regra em todo lugar e muda pouco. Um conceito de negócio não entra, porque cada módulo o enxerga de um jeito e o muda no próprio ritmo.

### Cada módulo tem a sua visão de um conceito

Para o catalog, um produto tem nome, preço atual e moeda, e pode mudar de preço a qualquer momento. Para o orders, basta o `productId` e o preço do momento da compra, que não muda se o catálogo mudar. Um `Product` no `shared` teria de servir aos dois, e cada mudança para um módulo arriscaria quebrar o outro.

O dado em si tem um único dono. O nome do produto pertence ao catalog. Quem precisa dele consulta pela facade ou guarda uma cópia local atualizada por eventos ([Comunicação entre módulos](comunicacao-entre-modulos.md)).

### Tipos que só parecem iguais

O nome igual engana. O identity tem um `Email`, value object com o endereço normalizado da conta, que valida o formato. O notifications tem um `Email` que é a mensagem enviada: destinatário, assunto e corpo ([glossário](../reference/glossario.md#mesmo-termo-sentidos-diferentes)). Um `Email` no `shared` misturaria os dois.

Mesmo quando o conceito é o mesmo, um value object usado por um módulo só fica nele. O `Email` do identity sobe para o `shared` quando outro módulo precisar da mesma regra, e não antes.

O `Money` é a exceção. Só o orders o usa no domínio, mas ele está no `shared` desde o começo do projeto, porque a regra dele não depende de módulo nenhum: valor em centavos inteiros, e somar moedas diferentes é erro. Já a normalização e a validação do `Email` do identity são regras de conta.

O exception filter segue a mesma lógica: o `shared` tem a base `DomainError`, e cada módulo tem o seu filter, com a tabela dos próprios códigos de erro para status HTTP.

### Na dúvida, duplique

Duplicar um tipo simples custa pouco: duas cópias pequenas, que podem divergir quando os módulos divergirem. Pôr no `shared` cedo demais custa mais: os módulos passam a depender um do outro através dele, e tirar um tipo do `shared` depois exige mexer em todos os que o usam.

## Alternativas e trade-offs

- **Um `shared` com os conceitos de negócio comuns (`Customer`, `Product`):** evita a duplicação e dá um lugar só para cada conceito. Em troca, o `shared` vira um módulo escondido do qual todos dependem, e as fronteiras deixam de existir na prática.
- **Nenhum `shared`, tudo duplicado:** cada módulo totalmente independente, como se fosse um serviço à parte. Em troca, a raiz de agregado, a outbox, a autenticação e a transação existiriam em cinco versões, e um bug corrigido numa continuaria nas outras.
- **O caminho escolhido** fica no meio, e o custo é o julgamento a cada tipo novo: o que tem a mesma regra em todo lugar vai para o `shared`, e o resto fica no módulo até provar o contrário.

## Decisões relacionadas

- [ADR 0003: Imports explícitos entre módulos, sem `@Global`](../adr/0003-imports-explicitos-entre-modulos.md): só a infraestrutura do `shared` é `@Global`.
