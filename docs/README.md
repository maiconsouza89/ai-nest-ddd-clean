# Documentação

A documentação segue o [Diátaxis](https://diataxis.fr/): cada página tem um tipo só, escolhido pelo que o leitor precisa naquele momento. Os agentes de código chegam às mesmas páginas pela tabela de rotas do [AGENTS.md](../AGENTS.md) ([ADR 0006](adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md)).

## Qual tipo de página

| Momento | Ação: fazer algo | Conhecimento: entender algo |
| --- | --- | --- |
| **Adquirir:** estudando | Tutorial (`tutorials/`) | Explicação (`explanation/`) |
| **Aplicar:** trabalhando | How-to (`how-to/`) | Referência (`reference/`) |

- **Tutorial:** uma aula guiada, do zero a um resultado que funciona, para quem está aprendendo.
- **How-to:** os passos para uma tarefa concreta, para quem já sabe o que quer fazer.
- **Referência:** fatos para consultar (comandos, variáveis, contratos), sem passo a passo nem justificativa.
- **Explicação:** o porquê do desenho, as alternativas e os trade-offs.

Uma pasta de quadrante só existe a partir da primeira página dela.

## How-to

- [Como criar um módulo](how-to/criar-um-modulo.md): do `plop module` ao helper dos testes de integração, e o que conferir antes do PR.
- [Como gerar uma migration](how-to/gerar-uma-migration.md): depois de mudar uma ORM entity, do generate ao helper dos testes de integração.
- [Como publicar um evento de integração](how-to/publicar-um-evento-de-integracao.md): do evento de domínio à outbox, o teste de contrato e o handler no módulo consumidor.
- [Como paginar uma listagem](how-to/paginar-uma-listagem.md): do `PaginationQuery` à query com desempate estável, e o cursor para listas grandes.
- [Como cachear uma leitura](how-to/cachear-uma-leitura.md): o decorator da query com chave por geração, a ligação no módulo, o handler de invalidação e os testes.
- [Como agendar um job](how-to/agendar-um-job.md): o processor sobre o `ScheduledJobProcessor`, a fila própria e o teste com duas instâncias.
- [Como adicionar uma variável de ambiente](how-to/adicionar-uma-variavel-de-ambiente.md): da validação ao `useFactory` do módulo, com o `.env.example`, o `RENAMED` e os testes.
- [Como criar um seed](how-to/criar-um-seed.md): dados de desenvolvimento com ids fixos e `orIgnore`, o `runSeed` e o script.

## Explicação

- [Arquitetura](explanation/arquitetura.md): monólito modular, regra de dependência, Nest só na infra e o papel de cada camada, com exemplos do orders.
- [Persistência](explanation/persistencia.md): por que a entidade de domínio e a ORM entity são classes diferentes, o mapper e a transação do caso de uso.
- [Comunicação entre módulos](explanation/comunicacao-entre-modulos.md): dados próprios por módulo, dependência numa direção só, facade que devolve resultado, contratos com versão e o que muda ao extrair um módulo para um serviço.
- [Agregados](explanation/agregados.md): por que o item fica no `Order` e o estoque no inventory, o port `StockGateway` e a reserva síncrona dentro da transação do pedido.
- [Consistência e eventos](explanation/consistencia-e-eventos.md): a transação pelo contexto, a concorrência otimista e a pessimista, a outbox, a fila por consumidor, o consumidor idempotente e a `Idempotency-Key`.
- [Modelagem do domínio](explanation/modelagem-do-dominio.md): dinheiro em centavos, id e hora por ports, erros com `code`, a mesma regra validada em mais de um lugar, domain service, exclusão como estado e auditoria.
- [Redis](explanation/redis.md): por que um Redis, filas e cache na mesma instância, o que acontece quando ele cai, o cache invalidado por geração e os jobs pelo agendador do BullMQ.
- [Serviços externos](explanation/servicos-externos.md): port e adapter para cada fornecedor, a tradução de erros, timeout em toda chamada, retry só no que é idempotente e o circuit breaker que ainda não existe.
- [Shared kernel](explanation/shared-kernel.md): por que o `shared` guarda só blocos técnicos e por que, na dúvida, o tipo fica duplicado.
- [Autenticação e ownership](explanation/autenticacao.md): autenticação na infra e ownership no caso de uso, o ator carregado a cada requisição, o refresh token rotativo e a corrida da renovação.
- [Observabilidade](explanation/observabilidade.md): por que o tracing carrega antes da app, o trace que atravessa a outbox e as filas, os logs com o id do trace e o que fica sem span.

## Referência

- [Comandos](reference/comandos.md): setup do zero, verificação, testes, migrations, seeds, geradores e como baixar o ambiente.
- [Variáveis de ambiente](reference/variaveis-de-ambiente.md): cada variável, com padrão, valores aceitos e efeito.
- [Versões e exceções](reference/versoes-e-excecoes.md): a regra de versões e os pacotes fora da latest, com o gatilho para atualizar.
- [Convenções](reference/convencoes.md): imports ESM, aliases `#...`, `import type`, versão da API HTTP e as regras das ORM entities do TypeORM.
- [Testes](reference/testes.md): o tipo de teste de cada camada, onde fica, com que fakes e containers, e o teste de contrato dos eventos.
- [Operação](reference/operacao.md): configuração HTTP, Swagger, health check, rate limit, logs de acesso e a ordem de desligamento.
- [Camadas](reference/camadas.md): o que fica em domain, application, infra, contracts e shared, em qual pasta, e as regras entre módulos.
- [Autenticação](reference/autenticacao.md): rotas, access token, refresh token e rotas protegidas.
- [Glossário](reference/glossario.md): termos comuns aos módulos, termos com mais de um sentido e o índice da linguagem ubíqua.
- [Leituras](reference/leituras.md): a documentação oficial e os textos de padrões consultados no desenho do projeto.

### Módulos

Uma página por módulo: linguagem ubíqua, contrato público, eventos, invariantes, dependências e schema.

- [orders](reference/modules/orders.md): pedidos, do rascunho ao pagamento ou ao cancelamento.
- [catalog](reference/modules/catalog.md): produtos e preços.
- [inventory](reference/modules/inventory.md): saldo de estoque e reservas.
- [identity](reference/modules/identity.md): contas, login, sessões e o ator de cada requisição.
- [notifications](reference/modules/notifications.md): avisos disparados por eventos.

## Decisões (ADR)

Registros imutáveis. Uma decisão nova, ou que substitui outra, ganha um ADR novo.

- [0001: Vitest e projeto em ESM](adr/0001-vitest-e-esm.md)
- [0002: Ator carregado a cada requisição](adr/0002-ator-carregado-por-requisicao.md)
- [0003: Imports explícitos entre módulos, sem `@Global`](adr/0003-imports-explicitos-entre-modulos.md)
- [0004: Prettier formata e ESLint com tipos pega bugs, sem sobreposição](adr/0004-lint-e-formatacao.md)
- [0005: Aliases de import com `imports` do `package.json`](adr/0005-aliases-de-import-por-subpath-imports.md)
- [0006: Documentação em Diátaxis com roteamento para agentes](adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md)

## Fora dos quadrantes

- [Guia: módulos com DDD e Clean Architecture](research/modules-ddd-clean-nest.md): só ponteiros para as páginas que receberam cada seção. Sai do repositório no passo 15 do [plano de documentação](plan/documentacao.md).
- [Planos](plan/): trabalho interno. O [passo a passo](plan/passo-a-passo.md) que montou o projeto do zero, o [plano de evolução](plan/evolucao.md) e o [plano de documentação](plan/documentacao.md).

## Como escrever uma página

1. Escolha o tipo pela tabela [Qual tipo de página](#qual-tipo-de-página). Se o texto pede dois tipos, são duas páginas, com link entre elas.
2. Gere a página: `npm run plop doc <tipo> "<nome em pt-BR>"`. No how-to, comece o nome pelo verbo (`"rodar as migrations"`). O gerador cria o arquivo na pasta certa, com o frontmatter `type:` igual à pasta e as seções do tipo.
3. Preencha as seções e apague os comentários do template. Um comentário que sobra é lido pelo agente como instrução.
4. Escreva de forma atemporal: sem "hoje", "atualmente" ou "novo". Data só em registro, por exemplo "consultado em 2026-11-23".
5. Ponha a página no índice acima. Se um agente precisa achá-la, acrescente uma linha na tabela de rotas do `AGENTS.md`, com o caminho em texto simples, sem `@`.
6. Rode `npm run docs:check`. Ele confere o lint do Markdown, os links e âncoras locais, o `type:`, os comentários de template e os caminhos citados nos arquivos de agente. Os links externos são conferidos com `npm run docs:links`.

Um ADR não sai do gerador. Copie o formato dos existentes (`status: accepted`, "Considered Options", "Consequences") com o próximo número.
