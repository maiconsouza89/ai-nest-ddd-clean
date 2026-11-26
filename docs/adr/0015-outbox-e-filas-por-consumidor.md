---
status: accepted
---

# Eventos de integração pela outbox, com uma fila por consumidor

Um caso de uso que muda um agregado avisa os outros módulos por eventos de integração. O aviso não pode sair sem o `save` nem se perder depois dele, e o Redis não participa da transação do Postgres. O projeto começou com a outbox e um relay que entregava cada evento a um barramento em memória (o `@nestjs/event-emitter`), que chamava os handlers dentro da transação que trava o lote. Um handler lento segurava o lote inteiro, e a falha de um consumidor fazia o evento voltar para todos.

O projeto grava os eventos de integração na tabela `shared.outbox`, na mesma transação do agregado, e os entrega pelo BullMQ, numa fila por consumidor.

- **Outbox transacional:** o caso de uso converte os eventos de domínio no contrato público e os grava na outbox, junto com o agregado.
- **Relay:** busca os pendentes com `FOR UPDATE ... SKIP LOCKED`, na ordem de cada agregado, enfileira cada evento e marca a linha como publicada. Uma falha adia a linha com backoff, e a linha que passa do limite de falhas fica morta (`deadAt`).
- **Uma fila por consumidor (`events.<consumidor>`):** o publicador enfileira uma cópia do evento para cada consumidor que o assina, com um `jobId` que junta o id do evento e o consumidor. Cada fila tem as próprias tentativas e o próprio conjunto `failed`.
- **Consumidor idempotente:** a entrega é "pelo menos uma vez". O `IdempotentConsumer` grava a marca em `shared.processed_events` na transação do efeito, e a entrega repetida não produz o efeito de novo.

O raciocínio está em [Entrega de eventos](../explanation/entrega-de-eventos.md), e os parâmetros em [Outbox e filas](../reference/outbox-e-filas.md).

## Considered Options

- **Publicar direto, depois do commit:** sem outbox nem relay. Se o processo cair entre o commit e a publicação, o evento se perde. Publicar antes do commit anuncia algo que pode ser desfeito.
- **Enfileirar no BullMQ dentro do caso de uso:** tira a outbox do caminho, mas o Redis não entra na transação do Postgres, e voltam os dois problemas da opção anterior.
- **Barramento em memória chamado pelo relay:** o desenho inicial. Dispensa o Redis na entrega, mas o handler roda dentro da transação do lote: um handler lento segura todos, e a falha de um devolve o evento a todos.
- **Entrega exatamente uma vez:** não existe entre o Postgres e o Redis sem uma transação distribuída.

## Consequences

- O Redis passa a fazer parte da entrega. Com ele fora do ar, o enfileiramento falha e conta como falha da linha da outbox. Passado o limite de falhas, o evento fica morto e só sai por intervenção manual.
- Há dois lugares de mortos: o `deadAt` da outbox, para o evento que não chegou a ser enfileirado, e o conjunto `failed` de cada fila, para o job que esgotou as tentativas.
- A ordem por agregado vale só até a fila. Um retry dentro dela pode inverter dois eventos, e nenhum consumidor pode depender da sequência.
- Todo consumidor com efeito no banco passa pelo `IdempotentConsumer`. Um efeito fora do banco, como um e-mail, pode se repetir.
- O nome do consumidor não muda depois de publicado: ele dá nome à fila e à marca em `shared.processed_events`.
- Os workers das filas podem rodar num processo separado da API (`QUEUE_WORKERS_ENABLED`).
- O `@nestjs/event-emitter` saiu das dependências.
