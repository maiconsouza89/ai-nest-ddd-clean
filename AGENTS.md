# AGENTS.md

<!-- Roteador lido por qualquer agente (ADR 0006). Os fatos ficam em docs/. Aqui ficam só o projeto em
poucas linhas, o resumo dos comandos de verificação, as armadilhas e os ponteiros. Meta: até 100 linhas.
Cite caminhos de docs/ em texto simples: o `@caminho` importa o arquivo inteiro em toda sessão. -->

## Projeto

API em NestJS: monólito modular com DDD e Clean Architecture, em ESM, com TypeORM sobre Postgres e Redis (cache, filas do BullMQ e rate limit).

- `src/modules/`: os módulos de negócio `orders`, `catalog`, `inventory`, `identity` e `notifications`. `src/shared/`: kernel compartilhado e infraestrutura transversal. `src/app.module.ts`: composição. `src/main.ts` carrega o `tracing.ts` antes do `bootstrap.ts`.
- Um módulo fala com outro só pelo `contracts/` dele e por eventos de integração, e declara de quem depende em `imports`. `@Global` é só para a infraestrutura do `shared` (ADR 0003).

## Verificação

- `npm run typecheck`, `npm run lint` e `npm run arch` (camadas e fronteiras entre módulos).
- `npm test` roda os unitários, sem banco. Um arquivo: `npm test -- money.vo` (padrão de caminho). O mesmo vale para `npm run test:int -- pay-order` e `npm run test:e2e -- auth`.
- `npm run test:int` sobe Postgres e Redis descartáveis pelo Testcontainers, isolados do docker-compose. Só precisa do Docker.
- `npm run test:e2e` sobe a app inteira contra o Postgres e o Redis do docker-compose (ver a armadilha do E2E abaixo).
- `npm run ci` roda typecheck, lint, format:check, docs:check, unitários e arch. Integração e e2e ficam fora: rode-os quando a mudança tocar banco, Redis, filas ou HTTP.

## Armadilhas

- **Imports:** relativo dentro da mesma fronteira, com `.js` mesmo para um `.ts` (`./money.vo.js`). Cruzando fronteira (`src/shared`, cada módulo, `test`), alias sem extensão: `#shared/*`, `#modules/*`, `#test/*`.
- **Injeção de dependência:** uma classe injetada pelo construtor entra com import de valor (`import { X }`). Com `import type`, ela some da decorator metadata e o Nest quebra em tempo de execução, sem aviso do `tsc`. Por isso a regra `consistent-type-imports` fica desligada.
- **oxc nos testes:** "can't resolve dependencies" num construtor costuma ser um parâmetro tipado com type alias ou utility type. O oxc emite `Object` para eles. Tipe o parâmetro com a classe.
- **Condição `@app/source`:** um script que roda o TypeScript direto (migrations, seeds) precisa de `--conditions=@app/source`. Sem ela, os aliases `#...` carregam o `dist/`, talvez velho, sem erro. O `plop module` já gera os scripts com ela.
- **Migrations:** não rodam ao subir a app. Rode `npm run mig:<módulo>:run`. Em loop no zsh, escreva `"mig:${m}:run"`, com chaves e aspas.
- **E2E:** grava no banco do docker-compose. Encerre qualquer `start:dev` antes: outra instância no mesmo Redis consome as filas do BullMQ e derruba os testes.
- **Baixar o ambiente:** só `docker compose down -v --remove-orphans`, na raiz deste repo. Nunca `docker volume prune` nem `docker system prune`, e nada de remover volumes, containers ou redes de outros projetos.

## Versões

Sempre a latest estável, menos as exceções de `docs/reference/versoes-e-excecoes.md`. Confira o gatilho registrado antes de atualizar um pacote da tabela.

## Definição de pronto

- `npm run ci` passa.
- Uma mudança de comportamento atualiza a página do quadrante afetado em `docs/`, ou o PR diz por que não precisa.

## Rotas

Leia a página antes de agir no assunto.

| Vai fazer | Leia |
| --- | --- |
| Rodar, testar, migrar, semear, gerar módulo ou página, subir ou baixar o ambiente | `docs/reference/comandos.md` |
| Ler ou acrescentar variável de ambiente | `docs/reference/variaveis-de-ambiente.md` e `docs/how-to/adicionar-uma-variavel-de-ambiente.md` |
| Adicionar ou atualizar dependência | `docs/reference/versoes-e-excecoes.md` |
| Escrever imports, mover arquivos entre módulos ou escrever uma ORM entity | `docs/reference/convencoes.md` |
| Mexer em login, tokens, guards, roles ou regra de dono | `docs/reference/autenticacao.md` e `docs/explanation/autenticacao.md` |
| Mudar um módulo existente: contrato, eventos, invariantes, schema | `docs/reference/modules/<módulo>.md` |
| Criar entidade, caso de uso, repositório ou outra classe, ou decidir em qual camada e pasta ela fica | `docs/reference/camadas.md` |
| Entender por que o projeto é um monólito modular em camadas | `docs/explanation/arquitetura.md` |
| Decidir se um objeto entra num agregado ou vira outro módulo | `docs/explanation/agregados.md` |
| Fazer um módulo usar outro, ou mudar um evento ou uma facade | `docs/explanation/comunicacao-entre-modulos.md` e `docs/reference/camadas.md` |
| Gerar uma migration depois de mudar uma ORM entity | `docs/how-to/gerar-uma-migration.md` |
| Publicar um evento de integração ou consumir um em outro módulo | `docs/how-to/publicar-um-evento-de-integracao.md` |
| Criar ou mudar uma listagem paginada | `docs/how-to/paginar-uma-listagem.md` |
| Cachear uma leitura ou mudar um cache | `docs/how-to/cachear-uma-leitura.md` |
| Criar ou mudar um job agendado | `docs/how-to/agendar-um-job.md` |
| Criar ou mudar um seed | `docs/how-to/criar-um-seed.md` |
| Mexer na conexão com o Redis, no cache ou no rate limit, ou entender o que acontece com o Redis fora do ar | `docs/explanation/redis.md` |
| Integrar um fornecedor externo, ou mexer em timeout ou retry de uma chamada externa | `docs/explanation/servicos-externos.md` |
| Mexer em transação, concorrência, outbox, filas, consumidor idempotente ou `Idempotency-Key` | `docs/explanation/consistencia-e-eventos.md` |
| Modelar valor, dinheiro, erro de domínio, validação, domain service ou exclusão | `docs/explanation/modelagem-do-dominio.md` e `docs/reference/camadas.md` |
| Escrever ou mudar um teste | `docs/reference/testes.md` |
| Mexer no tracing, no `main.ts` ou no `tracing.ts` | `docs/explanation/observabilidade.md` |
| Mexer no `app.setup.ts`, no Swagger, no health, no rate limit, nos logs de acesso ou no desligamento | `docs/reference/operacao.md` |
| Entender um termo do domínio ou um termo comum aos módulos | `docs/reference/glossario.md` |
| Criar um módulo novo | `docs/how-to/criar-um-modulo.md` |
| Entender o porquê de uma decisão | `docs/adr/` |
| Escrever ou mover documentação | `docs/README.md` |
| Continuar um plano em andamento | `docs/plan/` |
