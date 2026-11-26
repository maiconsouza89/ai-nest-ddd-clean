---
type: how-to
---

# Como agendar um job

Use este guia para rodar um caso de uso num horário fixo ou a cada intervalo, como a expiração de pedidos parados do orders.

## Pré-requisitos

- O caso de uso que o job vai rodar, testado sem o job. Ele recebe prazos e tamanho de lote pelo construtor, e trata um lote por execução: o que sobrar fica para o próximo disparo.
- Redis no ar para rodar a app ou o teste de integração: `docker compose up -d redis` ([Como preparar o ambiente local](preparar-o-ambiente-local.md)). O teste de integração sobe um Redis próprio e só precisa do Docker.

## Passos

1. Crie o processor em `infra/jobs/<tarefa>.processor.ts`, estendendo o `ScheduledJobProcessor` do `shared`:

   ```ts
   @Injectable()
   export class ExpirePendingOrdersProcessor extends ScheduledJobProcessor {
     constructor(
       private readonly useCase: ExpirePendingOrdersUseCase,
       connection: BullMqConnection,
       logger: Logger,
       config: ConfigService<EnvironmentVariables, true>,
     ) {
       super(
         { queue: 'jobs.orders', scheduler: 'orders.expire-pending-orders', pattern: '*/5 * * * *' },
         connection,
         logger,
         config,
       );
     }

     protected async run() {
       const expired = await this.useCase.execute();
       if (expired > 0) this.logger.info({ expired }, 'expired pending orders');
     }
   }
   ```

   - **`queue`:** uma fila só deste job. O worker roda `run()` para qualquer job da fila, então dois jobs nunca dividem uma. O primeiro job do módulo usa `jobs.<módulo>`. Um segundo job no mesmo módulo precisa de outro nome de fila.
   - **`scheduler`:** `<módulo>.<tarefa>`. É o id do agendador no Redis e o nome dos jobs que ele gera.
   - **`pattern`:** expressão cron. `'0 3 * * *'` roda uma vez por dia, às 3h.
   - **`run()`:** só chama o caso de uso e registra o resultado. Nenhuma regra de negócio fica aqui.
   - **Imports:** classes injetadas com import de valor, nunca `import type` ([Convenções](../reference/convencoes.md)).

2. Registre o processor nos `providers` do módulo Nest. O módulo precisa importar o `MessagingModule`, que exporta o `BullMqConnection`. O caso de uso entra por `useFactory`, como os outros.

3. Escreva o teste de integração em `infra/jobs/<tarefa>.processor.int-spec.ts`, a partir do `expire-pending-orders.processor.int-spec.ts`. Ele sobe um Redis descartável, liga duas instâncias do processor e confere quatro coisas:
   - um só agendador registrado, com o `pattern` certo;
   - cada disparo roda o caso de uso uma vez, mesmo com duas instâncias;
   - uma falha do caso de uso não derruba o worker, e o disparo seguinte roda;
   - com `JOBS_ENABLED=false`, nada é registrado.

4. Acrescente o job à doc do módulo, em `docs/reference/modules/<módulo>.md`: fila, agendador, frequência e as variáveis que ele obedece.

### Renomear ou apagar um job

O agendador antigo continua no Redis depois do deploy e segue gerando jobs na fila antiga, sem worker.

1. Renomeie ou apague o processor e faça o deploy.
2. Em cada ambiente em que o job antigo rodou, remova o agendador antigo, na raiz do repositório e com o `REDIS_URL` daquele ambiente:

   ```bash
   REDIS_URL=<REDIS_URL do ambiente> node --input-type=module -e "
   import { Queue } from 'bullmq';
   const queue = new Queue('<fila antiga>', { connection: { url: process.env.REDIS_URL } });
   console.log(await queue.removeJobScheduler('<scheduler antigo>'));
   await queue.close();
   "
   ```

   A saída `true` confirma a remoção. `false` quer dizer que não havia agendador com esse nome nessa fila.

## Como verificar

- `npm run test:int -- <tarefa>.processor` passa.
- `npm run arch` passa: o processor está em `infra/jobs/` e não importa repositório nem TypeORM.
- Com a app no ar, o log da subida não mostra `scheduler registration failed`. Com o Redis fora do ar, a subida falha com essa mensagem, em vez de seguir sem o job ([Redis](../explanation/redis.md#jobs-agendados)).

## Veja também

- [Redis](../explanation/redis.md#jobs-agendados): por que o agendador do BullMQ, a concorrência global de 1 e a fila por job.
- [Variáveis de ambiente](../reference/variaveis-de-ambiente.md): o `JOBS_ENABLED`, que liga e desliga os jobs da instância.
- [Camadas](../reference/camadas.md#infra): a linha "Job".
