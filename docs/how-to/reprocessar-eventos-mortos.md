---
type: how-to
---

# Como reprocessar eventos mortos

Use este guia para devolver à entrega as linhas da outbox com `deadAt`, depois de corrigida a causa que está no `lastError` delas. Uma queda do Redis não mata linha: um morto indica um defeito, como um consumidor com nome inválido ou um `NOPERM` do Redis.

## Pré-requisitos

- A causa corrigida e implantada. Sem isso, a linha reprocessada morre de novo depois de 8 falhas ([Outbox e filas](../reference/outbox-e-filas.md#relay-da-outbox)).
- Acesso ao banco por SQL, com permissão de `UPDATE` em `shared.outbox`. Nos exemplos, o Postgres do docker-compose: `docker compose exec postgres psql -U postgres -d app`. Num worktree, o banco é o `app_wt<N>`.
- O relay ligado em alguma instância (`OUTBOX_WORKER_ENABLED=true`).

## Passos

1. Inspecione os mortos. Ajuste o `type` e o período de `deadAt` ao que vai reprocessar:

   ```sql
   SELECT id, type, "aggregateId", attempts, "deadAt", "lastError"
   FROM shared.outbox
   WHERE "deadAt" IS NOT NULL
     AND type = 'orders.order-paid'
     AND "deadAt" >= '2026-11-26 10:00:00+00' AND "deadAt" < '2026-11-26 12:00:00+00'
   ORDER BY seq;
   ```

   Confira no `lastError` que todas as linhas morreram pela causa corrigida.

2. Devolva as linhas à busca dentro de uma transação, com o mesmo filtro:

   ```sql
   BEGIN;

   UPDATE shared.outbox
   SET "deadAt" = NULL, attempts = 0, "nextAttemptAt" = now()
   WHERE "deadAt" IS NOT NULL
     AND type = 'orders.order-paid'
     AND "deadAt" >= '2026-11-26 10:00:00+00' AND "deadAt" < '2026-11-26 12:00:00+00';
   ```

   O `lastError` fica até a próxima falha, para comparar.

3. Compare o número do `UPDATE <n>` com o número de linhas do passo 1. Se for igual, `COMMIT;`. Se não, `ROLLBACK;` e revise o filtro.

4. Acompanhe a entrega. A próxima rodada do relay pega as linhas, em ordem de `seq`:
   - no log, `delivering event` com o `eventId` de cada linha, e `processing event` com o nome do consumidor;
   - na métrica `outbox.events`, a série com `outbox.event.state=dead` cai ([Observabilidade](../reference/observabilidade.md)).

Cuidados:

- **O job morto no BullMQ não volta por aqui.** Um evento que chegou à fila e esgotou as tentativas está no conjunto `failed` da fila do consumidor, e a linha dele na outbox já tem `publishedAt`. Este guia vale só para o `deadAt` da outbox ([Outbox e filas](../reference/outbox-e-filas.md#opções-dos-jobs)).
- **A linha revivida segura o agregado.** Até ser entregue, ela segura os pendentes seguintes do mesmo `aggregateId`, como qualquer pendente ([Entrega de eventos](../explanation/entrega-de-eventos.md#o-evento-sai-pela-outbox)). Os eventos do agregado que saíram enquanto ela estava morta não esperam: o consumidor recebe o revivido depois deles.
- **O efeito não se repete.** A linha leva o mesmo `eventId`. Na fila, o `jobId` ignora o job que ainda existe, e o `IdempotentConsumer` pula o efeito já marcado em `shared.processed_events`.

## Como verificar

As linhas saem de `dead` e ganham `publishedAt`:

```sql
SELECT id, attempts, "deadAt", "publishedAt", "lastError"
FROM shared.outbox
WHERE id IN ('<id do passo 1>');
```

`deadAt` nulo e `publishedAt` preenchido. Com `publishedAt` nulo e `attempts` subindo, a causa não foi corrigida: o `lastError` mostra a falha nova.

## Veja também

- [Outbox e filas](../reference/outbox-e-filas.md): a tabela `shared.outbox`, o limite de falhas e as filas.
- [Entrega de eventos](../explanation/entrega-de-eventos.md): por que a falha de transporte não mata a linha e por que a entrega repetida não duplica o efeito.
- [ADR 0016: Falha de transporte não conta para a morte do evento da outbox](../adr/0016-falha-de-transporte-nao-mata-evento-da-outbox.md)
