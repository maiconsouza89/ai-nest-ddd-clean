---
type: how-to
---

# Como gerar uma migration

Use este guia depois de mudar uma ORM entity de um módulo que já existe (coluna, tabela, índice). Para criar um módulo, o `npm run plop module` já gera a primeira migration, a que cria o schema. Sem o gerador, crie essa primeira vazia com `npx typeorm-ts-node-esm migration:create <pasta migrations do módulo>/create-<módulo>-schema` e escreva o `CREATE SCHEMA IF NOT EXISTS <módulo>` no `up`.

## Pré-requisitos

- Postgres no ar: `docker compose up -d postgres` ([Comandos](../reference/comandos.md#setup-do-zero)).
- Todas as migrations do módulo aplicadas: `npm run mig:<módulo>:run`. O generate compara as entidades com o banco, e um banco atrasado faz a migration nova repetir as antigas.
- A ORM entity alterada seguindo as [convenções do TypeORM](../reference/convencoes.md#typeorm). Uma entity nova também precisa entrar no `entities` do DataSource do módulo (`<módulo>.data-source.ts`) e no `TypeOrmModule.forFeature` do módulo Nest.

## Passos

1. Gere a migration:

   ```bash
   npm run mig:<módulo>:gen
   ```

   O arquivo sai em `migrations/` do módulo, com o nome `<timestamp>-change.ts` e a classe `Change<timestamp>`. Se a saída for "No changes in database schema were found", a entity não mudou, o DataSource não a lista, ou o banco já tem a mudança.

2. Renomeie o arquivo e a classe para dizer o que a migration faz, **antes** de rodá-la. Troque `change` no arquivo e `Change` na classe e no `name`, mantendo o timestamp:

   ```text
   1795464380867-change.ts         →  1795464380867-add-order-note.ts
   Change1795464380867             →  AddOrderNote1795464380867
   ```

   O TypeORM reconhece uma migration já aplicada pelo nome da classe. Renomear depois de rodar faz o `run` tentar aplicá-la de novo, e ele falha.

3. Leia o `up` e o `down`. O generate compara entidades e banco, e pode propor o que você não pediu: apagar uma coluna, recriar um índice, mudar um tipo. Uma coluna `NOT NULL` nova numa tabela com dados precisa de `DEFAULT` ou de um passo que preencha as linhas.

4. Aplique:

   ```bash
   npm run mig:<módulo>:run
   ```

5. Acrescente a classe da migration ao fim da lista `migrations` em `test/helpers/<módulo>-database.ts`. Os testes de integração não leem a pasta: aplicam só as migrations dessa lista, na ordem. Uma entity nova entra também na lista `entities` do mesmo arquivo.

6. Se o schema mudou o que a doc do módulo descreve, atualize a seção "Schema e migrations" em `docs/reference/modules/<módulo>.md`.

As pastas `migrations/` ficam fora do Prettier e do ESLint. O arquivo gerado entra como está.

## Como verificar

- `npm run mig:<módulo>:gen` de novo responde "No changes in database schema were found": o banco bate com as entidades.
- `npm run test:int -- <módulo>` passa. Os testes de integração montam o template do módulo aplicando do zero as migrations listadas no helper do passo 5.

Para desfazer a última migration aplicada no banco local, antes do commit:

```bash
NODE_OPTIONS=--conditions=@app/source npx typeorm-ts-node-esm migration:revert -d <caminho do DataSource do módulo>
```

O caminho do DataSource está no script `mig:<módulo>:run` do `package.json`. Depois do revert, apague o arquivo da migration ou corrija-o e rode de novo.

## Veja também

- [Comandos](../reference/comandos.md#migrations): os scripts `mig:<módulo>:*` e a condição `@app/source`.
- [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md#cada-módulo-tem-schema-e-migrations-próprios): por que cada módulo tem schema, DataSource e tabela de migrations próprios.
- [Persistência](../explanation/persistencia.md): por que a ORM entity é separada da entidade de domínio.
