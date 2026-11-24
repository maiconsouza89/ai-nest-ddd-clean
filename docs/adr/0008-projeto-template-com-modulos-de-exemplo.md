---
status: accepted
---

# Projeto template com módulos de exemplo

O repositório é um template público: quem o usa cria um repositório a partir dele e escreve os próprios módulos. O código se divide em duas partes:

- **Base:** o `shared` (banco, cache, filas, outbox, auth, observabilidade, jobs e rate limit), o identity (contas, verificação do e-mail, login e sessões) e o notifications (e-mails por SMTP disparados pelos eventos do identity). Acompanha todo projeto feito do template.
- **Exemplos:** o orders, o catalog e o inventory, mais o aviso de pedido pago do notifications. Ficam no repositório para serem lidos e, quando não servirem mais, removidos ([Como remover os módulos de exemplo](../how-to/remover-os-modulos-de-exemplo.md)).

A base não depende dos exemplos: o `src` da base só os cita nos pontos de ligação que o how-to remove (a composição no `app.module.ts`, o registro do aviso de pedido pago no `notifications.module.ts` e a `ORDER_EXPIRATION_MINUTES` no `env.validation.ts`), e os testes da base usam rotas, eventos e helpers da base. Remover os exemplos deixa a app de pé, com o `npm run ci`, a integração e o e2e passando, o que foi conferido seguindo o how-to num worktree descartável.

Os exemplos ficam porque mostram, funcionando e testados, os desenhos que a base (um módulo em camadas e um consumidor de eventos) não mostra:

- o orders, um agregado com itens, status, concorrência otimista, outbox, `Idempotency-Key`, job agendado, cache e paginação;
- o catalog, um módulo CRUD direto, sem as camadas, para quando não há regra de negócio;
- o inventory, um módulo sem entidade, chamado pelo orders por facade, com a reserva síncrona dentro da transação do pedido.

## Considered Options

- **Esqueleto vazio, só com a base:** o repositório fica menor e não há o que apagar, mas os padrões de agregado, de CRUD sem camadas e de reserva entre módulos viram texto sem código para conferir. A documentação explica esses desenhos com o código dos exemplos, e um exemplo testado não envelhece sem o CI perceber.
- **Exemplos num repositório ou branch à parte:** o template sai limpo, mas os exemplos deixam de rodar no CI da base e se desencontram dela na primeira mudança do `shared`.

## Consequences

- Quem usa o template apaga os exemplos seguindo o how-to, que lista cada lugar que muda.
- A documentação continua usando os exemplos como modelo: tutorial, explicações, how-tos e referência citam o orders, o catalog e o inventory. O how-to de remoção lista as páginas afetadas e o que fazer com cada uma. Descolar a documentação dos exemplos fica para depois.
- Uma mudança na base não pode passar a depender de um exemplo. O `npm run arch` impede o `shared` de importar um módulo, mas não distingue base de exemplo entre os módulos: isso é conferido pelo how-to de remoção.
