# Guia: módulos com DDD e Clean Architecture no NestJS

Nov 20, 2026 · @Maicon Souza da Silva

## Visão geral

Movida para [Arquitetura](../explanation/arquitetura.md): o que torna o sistema um monólito modular, a regra de dependência e o Nest só na infra.

## Estrutura de pastas

Movida para [Camadas](../reference/camadas.md#estrutura-de-pastas).

## Camadas

Movida. As regras de cada camada estão em [Camadas](../reference/camadas.md), e o porquê, com exemplos do orders, em [Arquitetura](../explanation/arquitetura.md).

## Persistência com TypeORM

Movida. O porquê da entidade de domínio separada da ORM entity está em [Persistência](../explanation/persistencia.md), e as regras das ORM entities em [Convenções](../reference/convencoes.md#typeorm).

## Módulos independentes

Movida. O porquê está em [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md#cada-módulo-tem-schema-e-migrations-próprios), as regras em [Camadas](../reference/camadas.md#entre-módulos), e o passo a passo de uma migration em [Como gerar uma migration](../how-to/gerar-uma-migration.md).

## Itens comuns entre módulos (shared kernel)

Movida. O que vai para o `shared` está em [Camadas](../reference/camadas.md#shared), e o porquê em [Shared kernel](../explanation/shared-kernel.md).

## Autenticação e ownership

Movida. O porquê está em [Autenticação e ownership](../explanation/autenticacao.md), e as rotas, prazos e respostas em [Autenticação](../reference/autenticacao.md).

## Agregados e comunicação entre módulos

Movida para [Agregados](../explanation/agregados.md): o que fica no agregado `Order`, o estoque pelo port `StockGateway` e a reserva síncrona dentro da transação do pedido.

## Dependências e contratos entre módulos

Movida. O porquê da dependência numa direção só, da facade que devolve resultado e da versão dos contratos está em [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md). As regras dos contratos estão em [Camadas](../reference/camadas.md#contracts), e as da versão da API HTTP, em [Convenções](../reference/convencoes.md#versionamento-da-api-http).

## Transações, concorrência e eventos

Movida. O porquê da transação pelo contexto, da concorrência otimista, da outbox, da fila por consumidor e do consumidor idempotente está em [Consistência e eventos](../explanation/consistencia-e-eventos.md), e o passo a passo de um evento novo em [Como publicar um evento de integração](../how-to/publicar-um-evento-de-integracao.md).

## Paginação

Movida para [Como paginar uma listagem](../how-to/paginar-uma-listagem.md): o `PaginationQuery`, a query com `findAndCount` ou com `GROUP BY`, o desempate pelo `id` e o cursor para listas grandes.

## Modelagem do domínio

Movida para [Modelagem do domínio](../explanation/modelagem-do-dominio.md): o dinheiro em centavos, o `Clock` e o `IdGenerator`, os erros com `code`, a validação em mais de um lugar, o domain service, a exclusão como estado e a auditoria. Onde fica cada peça e cada validação está em [Camadas](../reference/camadas.md#domain).

## Infra: configuração, jobs, cache e serviços externos

Movida. Os passos estão em [Como adicionar uma variável de ambiente](../how-to/adicionar-uma-variavel-de-ambiente.md), [Como agendar um job](../how-to/agendar-um-job.md), [Como cachear uma leitura](../how-to/cachear-uma-leitura.md) e [Como criar um seed](../how-to/criar-um-seed.md). O porquê do Redis, do cache por geração e do agendador do BullMQ está em [Redis](../explanation/redis.md), e o dos ports, do timeout e do retry nas chamadas a fornecedores, em [Serviços externos](../explanation/servicos-externos.md). As variáveis estão em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md).

## Qualidade

Movida. Que teste cobre cada camada, e com o quê, está em [Testes](../reference/testes.md). A divisão entre `tsc`, ESLint, Prettier e dependency-cruiser está no [ADR 0004](../adr/0004-lint-e-formatacao.md), e os comandos em [Comandos](../reference/comandos.md#verificação). As regras de arquitetura ficam no `.dependency-cruiser.js`, cada uma com o comentário que o `npm run arch` imprime, e o que nenhuma regra confere está em [Camadas](../reference/camadas.md). O porquê do tracing, do trace que atravessa a outbox e dos logs ligados a ele está em [Observabilidade](../explanation/observabilidade.md).

## Operação

Movida. A configuração HTTP, o Swagger, o health check, o rate limit, os logs de acesso e a ordem de desligamento estão em [Operação](../reference/operacao.md). O que muda ao extrair um módulo para um serviço está em [Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md#extrair-um-módulo-para-um-serviço).

## Pragmatismo e checklist

Movida. Quando um módulo dispensa as camadas está em [Arquitetura](../explanation/arquitetura.md#nem-todo-módulo-precisa-das-camadas). O gerador, os passos depois dele e o checklist antes do PR estão em [Como criar um módulo](../how-to/criar-um-modulo.md).

## Referências

Movida para [Leituras](../reference/leituras.md).
