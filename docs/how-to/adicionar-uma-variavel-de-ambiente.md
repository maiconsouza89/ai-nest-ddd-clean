---
type: how-to
---

# Como adicionar uma variável de ambiente

Use este guia quando um prazo, um limite, um endereço ou um interruptor precisa mudar por ambiente sem mudar o código. O que cada variável existente faz está em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md).

## Pré-requisitos

- O valor muda de um ambiente para outro. Uma constante que só o código muda fica no módulo Nest, como o `EXPIRATION_BATCH_SIZE` do `orders.module.ts`.
- O caso de uso que usa o valor já o recebe pelo construtor. Ele não lê variável de ambiente ([Camadas](../reference/camadas.md#application), linha "Configuração").

## Passos

1. Declare a variável na classe `EnvironmentVariables`, em `src/shared/infra/config/env.validation.ts`, com os decoradores do `class-validator`:

   ```ts
   // pedidos em DRAFT/PLACED parados por mais tempo que isso são cancelados
   @IsInt()
   @Min(1)
   ORDER_EXPIRATION_MINUTES: number = 1440;
   ```

   - **Opcional:** com valor padrão, como acima.
   - **Obrigatória:** sem padrão e com `!` (`DATABASE_URL!: string`).
   - **Interruptor:** tipo `string` com `@IsIn(['true', 'false'])`, nunca `boolean`. O `enableImplicitConversion` transformaria o texto `'false'` em `true`. Compare com `=== 'true'` onde ler.
   - **Número:** `@IsInt()` com `@Min` e `@Max`. A conversão do texto para número é automática.

2. Acrescente a variável ao `.env.example`, com um valor de desenvolvimento e, se o nome não bastar, um comentário na linha de cima. O `.env` de cada pessoa não é versionado.

3. Leia o valor no módulo Nest, no `useFactory` do caso de uso, e passe-o pronto ao construtor:

   ```ts
   {
     provide: ExpirePendingOrdersUseCase,
     useFactory: (/* ... */ config: ConfigService<EnvironmentVariables, true>) =>
       new ExpirePendingOrdersUseCase(/* ... */ {
         maxIdleMs: config.getOrThrow('ORDER_EXPIRATION_MINUTES', { infer: true }) * 60_000,
         batchSize: EXPIRATION_BATCH_SIZE,
       }),
     inject: [/* ... */ ConfigService],
   }
   ```

   Com `ConfigService<EnvironmentVariables, true>` e `{ infer: true }`, uma chave que não existe na classe não compila, e o valor sai com o tipo declarado. Converta a unidade aqui (minutos para milissegundos), e não no caso de uso.

4. Se a variável substitui outra, acrescente o nome antigo ao `RENAMED` do mesmo arquivo: `{ NOME_ANTIGO: 'NOME_NOVO' }`. Um ambiente que ainda define o nome antigo passa a barrar a subida, em vez de o valor ser ignorado e o padrão do nome novo valer sem aviso.

5. Se a variável é obrigatória, defina um valor em `test/setup-env.ts` (com `??=`, para não sobrescrever o ambiente). Sem ele, os testes que sobem o `AppModule` falham na validação.

6. Acrescente um caso em `src/shared/infra/config/env.validation.spec.ts`: o padrão, a conversão ou a recusa de um valor inválido.

7. Documente a variável na tabela da seção certa de `docs/reference/variaveis-de-ambiente.md`, com o padrão, os valores aceitos e o efeito.

Uma variável obrigatória também passa a ser exigida pelos scripts de migration e de seed: o DataSource de cada módulo, usado pela CLI fora do Nest, carrega os arquivos `.env` com o `loadEnvFiles()` (`src/shared/infra/config/load-env-files.ts`), pela mesma regra da app, e chama o mesmo `validateEnv`.

Se a configuração de um módulo crescer a ponto de poluir a classe única, o `@nestjs/config` separa por módulo com `registerAs` e `ConfigModule.forFeature`. O projeto não usa essa forma.

## Como verificar

- `npm test -- env.validation` passa.
- `npm run start:dev` com um valor inválido no `.env` não sobe, e a mensagem `Invalid environment configuration` lista a variável e a regra que falhou. Com o valor válido, a app sobe.
- `npm run typecheck` passa. Um erro de digitação na chave do `getOrThrow` não compila.

## Veja também

- [Variáveis de ambiente](../reference/variaveis-de-ambiente.md): todas as variáveis e a ordem de carga dos arquivos `.env`.
- [Camadas](../reference/camadas.md#infra): o módulo Nest lê o `ConfigService` e passa valores ao caso de uso.
- [Arquitetura](../explanation/arquitetura.md): por que o Nest fica só na infra.
