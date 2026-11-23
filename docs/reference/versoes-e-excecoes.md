---
type: reference
---

# Versões e exceções

## Regra

- Use sempre a **latest estável** de cada pacote.
- Quando a latest de um pacote quebra outro, use a maior versão compatível e registre a exceção na tabela abaixo, com o motivo e o gatilho para atualizar.
- Não atualize um pacote da tabela sem conferir o gatilho registrado.
- Prefira as bibliotecas oficiais e as recomendadas pela documentação do framework (por exemplo, os pacotes `@nestjs/*`) a alternativas de terceiros, salvo justificativa explícita.
- Ao propor uma dependência, informe a versão consultada e por que ela é a recomendada.
- Pacotes pré-1.0 sem histórico ficam de fora. Por exemplo, `@nestjs/authentication` 0.1.7 e `@nestjs/authorization` 0.1.4, lançados em 2026-09. O gatilho para reavaliá-los está no [passo 18 do plano de evolução](../plan/evolucao.md#passo-18-evoluções-sob-demanda).

`npm outdated` deve listar só os pacotes da tabela.

## Exceções

Consultadas em 2026-11-21.

| Pacote | Fica em | Latest | Motivo | Atualize quando |
| --- | --- | --- | --- | --- |
| `typescript` | `~6.0` | 7.0.2 | O TS 7 não expõe a API do compilador. O `@nestjs/cli` 12.0.15 depende de `typescript ~6.0.2` e o `typescript-eslint` 8.73 aceita só `>=4.8.4 <6.1.0`. O `dependency-cruiser` 18.9 já aceita o TS `>=7.1` (o 7.0 não, conferido em 2026-11-23). | O `@nestjs/cli` e o `typescript-eslint` aceitarem o TS 7.1 ou superior. Para o TS 6.1, basta o `typescript-eslint` aceitar |
| `keyv`, `@keyv/redis` | `^5.6`, `^5.1` | 6.1.0 | O `cache-manager` 7.2.9 depende de `keyv ^5.6`. Misturar as linhas 5 e 6 deixa duas Keyv no projeto. | O `cache-manager` depender da `keyv` 6 |
| `ioredis` | `^5.11` | 6.1.0 | O `typeorm` 1.1.3 (latest, `dev` e `beta` também) declara `ioredis ^5.0.4` como peer opcional, e o `npm install` falha com ERESOLVE. O TypeORM só usa o ioredis no cache de queries, que o projeto não usa, mas o override esconderia a incompatibilidade. O ioredis 6 também passa a usar RESP3 por padrão. | O `typeorm` aceitar o ioredis 6 (issue typeorm/typeorm#12823, PR #12830). Revise então `BullMqConnection`, `RedisThrottlerStorage` e o `keys` do e2e de throttle: `protocol: 2` mantém o formato do 5 |
| `argon2` | `^0.45` | 0.45.2 | É 0.x, mas tem anos de produção. O Argon2id é o algoritmo nº 1 do OWASP para senhas. | — (exceção à regra "≥ 1.0") |
