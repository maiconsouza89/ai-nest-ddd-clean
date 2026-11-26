---
type: how-to
---

# Como rodar um teste específico

Use este guia para rodar um arquivo de teste, ou um teste dentro dele, sem esperar a suíte inteira.

## Pré-requisitos

- **Unitário** (`*.spec.ts`): só o `npm install`.
- **Integração** (`*.int-spec.ts`): Docker no ar. Cada arquivo sobe, descartável, só o que usa: o Postgres, o Redis ou os dois.
- **E2E** (`*.e2e-spec.ts`): o Postgres e o Redis do `docker-compose.yml` no ar, com as [migrations aplicadas](rodar-as-migrations-e-os-seeds.md), e nenhum `start:dev` rodando. Outra instância no mesmo Redis consome as filas do BullMQ e derruba o teste. O e2e grava nesse banco.

## Passos

1. Escolha o script pelo sufixo do arquivo:

   | Sufixo | Script |
   | --- | --- |
   | `.spec.ts` | `npm test` |
   | `.int-spec.ts` | `npm run test:int` |
   | `.e2e-spec.ts` | `npm run test:e2e` |

   Cada script só enxerga os arquivos do seu tipo. Um `int-spec` passado ao `npm test` não é encontrado.

2. Passe um trecho do caminho do arquivo depois do `--`:

   ```bash
   npm test -- money.vo
   ```

   Roda todo arquivo cujo caminho contém o trecho, sem diferenciar maiúsculas. Vários trechos rodam a união: `npm test -- money.vo order-item`.

3. Para um teste só dentro do arquivo, filtre pelo nome com `-t`:

   ```bash
   npm test -- money.vo -t "soma valores"
   ```

   O `-t` recebe uma regex, comparada com o nome completo do teste, que inclui os `describe` separados por ` > `. Os outros testes do arquivo aparecem como `skipped`.

   Ou pela linha do `it`, com o caminho completo do arquivo:

   ```bash
   npm test -- src/shared/domain/money.vo.spec.ts:11
   ```

4. Para repetir a cada mudança, só nos unitários: `npm run test:watch -- money.vo`.

## Como verificar

O resumo mostra o número de arquivos e de testes esperado, por exemplo `Test Files  1 passed (1)` e `Tests  1 passed | 5 skipped (6)`.

`No test files found, exiting with code 1` quer dizer que nenhum arquivo do tipo do script contém o trecho. A saída mostra o `include` do projeto: confira o sufixo e o script.

## Veja também

- [Comandos](../reference/comandos.md#testes): os scripts de teste e os cuidados com o e2e.
- [Testes](../reference/testes.md): que tipo de teste cobre cada camada e onde ele fica.
