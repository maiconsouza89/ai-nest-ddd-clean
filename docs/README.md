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

## Tutoriais

- [Do clone ao primeiro pedido](tutorials/01-do-clone-ao-primeiro-pedido.md): a app no ar com os dados de exemplo, um usuário seu e um pedido criado, fechado e pago pela API.

## How-to

- [Como preparar o ambiente local](how-to/preparar-o-ambiente-local.md): do `npm install` à API no ar, com o banco, os seeds e o Mailpit.
- [Como criar um módulo](how-to/criar-um-modulo.md): do `plop module` ao helper dos testes de integração, e o que conferir antes do PR.
- [Como gerar uma migration](how-to/gerar-uma-migration.md): depois de mudar uma ORM entity, do generate ao helper dos testes de integração.
- [Como publicar e consumir um evento de integração](how-to/publicar-um-evento-de-integracao.md): do evento de domínio à outbox, o teste de contrato e o handler no módulo consumidor.
- [Como paginar uma listagem](how-to/paginar-uma-listagem.md): do `PaginationQuery` à query com desempate estável.
- [Como cachear uma leitura](how-to/cachear-uma-leitura.md): o decorator da query com chave por geração, a ligação no módulo, o handler de invalidação e os testes.
- [Como agendar um job](how-to/agendar-um-job.md): o processor sobre o `ScheduledJobProcessor`, a fila própria e o teste com duas instâncias.
- [Como adicionar uma variável de ambiente](how-to/adicionar-uma-variavel-de-ambiente.md): da validação ao `useFactory` do módulo, com o `.env.example`, o `RENAMED` e os testes.
- [Como criar um seed](how-to/criar-um-seed.md): dados de desenvolvimento com ids fixos e `orIgnore`, o `runSeed` e o script.
- [Como rodar as migrations e os seeds](how-to/rodar-as-migrations-e-os-seeds.md): o `db:setup`, o `db:seed`, como conferir o que falta e os erros comuns.
- [Como fazer o deploy](how-to/fazer-o-deploy.md): a imagem Docker, as migrations num passo antes da app, as variáveis, as probes e o tempo de desligamento.
- [Como testar a imagem de produção localmente](how-to/testar-a-imagem-de-producao-localmente.md): a imagem de produção com o profile `prod` do compose, isolada do ambiente de desenvolvimento.
- [Como usar um Postgres gerenciado](how-to/usar-um-postgres-gerenciado.md): a `DATABASE_URL`, o SSL, as permissões, a rede e o PgBouncer.
- [Como atualizar o contrato OpenAPI](how-to/atualizar-o-contrato-openapi.md): regenerar o `openapi.json`, resolver o conflito depois do rebase e aceitar uma quebra intencional.
- [Como mudar uma action do CI](how-to/mudar-uma-action-do-ci.md): o `uses:`, o lockfile das actions e a política "Require lockfile".
- [Como atualizar uma dependência](how-to/atualizar-uma-dependencia.md): a exceção e o gatilho, o Prettier com versão exata e o PR do Dependabot.
- [Como rodar um teste específico](how-to/rodar-um-teste-especifico.md): o script por tipo de teste, o filtro por caminho, por nome e por linha.
- [Como resetar o ambiente local](how-to/resetar-o-ambiente-local.md): apagar o Postgres e o Redis deste projeto e subir tudo do zero.
- [Como trabalhar com worktrees em paralelo](how-to/trabalhar-com-worktrees-em-paralelo.md): o `worktree:setup`, a porta, o banco, o Redis e a tag do Mailpit de cada worktree, e como limpar sem apagar os dados dos outros.
- [Como remover os módulos de exemplo](how-to/remover-os-modulos-de-exemplo.md): tirar o orders, o catalog e o inventory e ficar só com a base, com o CI verde no fim.

## Explicação

- [Arquitetura](explanation/arquitetura.md): monólito modular, regra de dependência, Nest só na infra e o papel de cada camada, com exemplos do orders.
- [Persistência](explanation/persistencia.md): por que a entidade de domínio e a ORM entity são classes diferentes, o mapper, a leitura sem agregado, e o pool e os timeouts da conexão com o Postgres.
- [Comunicação entre módulos](explanation/comunicacao-entre-modulos.md): dados próprios por módulo, dependência numa direção só, facade que devolve resultado, contratos com versão e o que muda ao extrair um módulo para um serviço.
- [Agregados](explanation/agregados.md): por que o item fica no `Order` e o estoque no inventory, o port `StockGateway` e a reserva síncrona dentro da transação do pedido.
- [Transações e concorrência](explanation/transacoes-e-concorrencia.md): a transação pelo contexto, a concorrência otimista e a pessimista, o update condicional do estoque e a `Idempotency-Key`.
- [Entrega de eventos](explanation/entrega-de-eventos.md): a outbox, a fila por consumidor e o consumidor idempotente.
- [Modelagem do domínio](explanation/modelagem-do-dominio.md): dinheiro em centavos, id e hora por ports, erros com `code`, a mesma regra validada em mais de um lugar, domain service, exclusão como estado e auditoria.
- [Redis](explanation/redis.md): por que um Redis, filas e cache na mesma instância, como cada uso falha quando ele cai, o cache invalidado por geração e os jobs pelo agendador do BullMQ.
- [Serviços externos](explanation/servicos-externos.md): port e adapter para cada fornecedor, a tradução de erros, timeout em toda chamada, retry só no que é idempotente e o circuit breaker que ainda não existe.
- [Shared kernel](explanation/shared-kernel.md): por que o `shared` guarda só blocos técnicos e por que, na dúvida, o tipo fica duplicado.
- [Autenticação e ownership](explanation/autenticacao.md): autenticação na infra e ownership no caso de uso, o ator carregado a cada requisição, o refresh token rotativo e a corrida da renovação.
- [Observabilidade](explanation/observabilidade.md): por que o tracing carrega antes da app, o trace que atravessa a outbox e as filas, os logs com o id do trace, como as métricas são coletadas e o que fica sem span.
- [Estratégia de testes](explanation/estrategia-de-testes.md): por que cada camada tem o seu tipo de teste, a meta de cobertura e o isolamento do banco.

## Referência

- [Comandos](reference/comandos.md): requisitos, serviços do docker-compose, endereços, verificação, hooks do git, testes, worktrees, migrations, seeds, geradores e como baixar o ambiente.
- [Variáveis de ambiente](reference/variaveis-de-ambiente.md): cada variável, com padrão, valores aceitos e efeito.
- [Versões e exceções](reference/versoes-e-excecoes.md): a regra de versões e os pacotes fora da latest, com o gatilho para atualizar.
- [Evoluções com gatilho](reference/evolucoes-com-gatilho.md): mudanças adiadas de propósito, com a condição que destrava cada uma.
- [Outbox e filas](reference/outbox-e-filas.md): os parâmetros da outbox, as opções dos jobs das filas de eventos, o nome das filas e a marca do consumidor.
- [Observabilidade](reference/observabilidade.md): as métricas, a coleta e os alertas de exemplo.
- [Convenções](reference/convencoes.md): imports ESM, aliases `#...`, `import type`, versão da API HTTP e as regras das ORM entities do TypeORM.
- [Testes](reference/testes.md): o tipo de teste de cada camada, onde fica, com que fakes e containers, e o teste de contrato dos eventos.
- [Operação](reference/operacao.md): configuração HTTP, Swagger, health check, rate limit, logs de acesso, o Redis fora do ar e a ordem de desligamento.
- [Respostas de erro](reference/respostas-de-erro.md): o formato Problem Details, o `code` de cada erro, o mapa de status dos módulos, a validação e o log.
- [Camadas](reference/camadas.md): o que fica em domain, application, infra, contracts e shared, em qual pasta, e as regras entre módulos.
- [Autenticação](reference/autenticacao.md): rotas, access token, refresh token e rotas protegidas.
- [Glossário](reference/glossario.md): termos comuns aos módulos, termos com mais de um sentido e o índice da linguagem ubíqua.
- [Leituras](reference/leituras.md): a documentação oficial e os textos de padrões consultados no desenho do projeto.

### Módulos

Uma página por módulo: linguagem ubíqua, contrato público, eventos, invariantes, dependências e schema.

- [orders](reference/modules/orders.md): pedidos, do rascunho ao pagamento ou ao cancelamento.
- [catalog](reference/modules/catalog.md): produtos e preços.
- [inventory](reference/modules/inventory.md): saldo de estoque e reservas.
- [identity](reference/modules/identity.md): contas, verificação do e-mail, login, sessões e o ator de cada requisição.
- [notifications](reference/modules/notifications.md): e-mails por SMTP disparados por eventos: código de verificação, boas-vindas e pagamento confirmado.

## Decisões (ADR)

Registros imutáveis. Uma decisão nova, ou que substitui outra, ganha um ADR novo.

- [0001: Vitest e projeto em ESM](adr/0001-vitest-e-esm.md)
- [0002: Ator carregado a cada requisição](adr/0002-ator-carregado-por-requisicao.md)
- [0003: Imports explícitos entre módulos, sem `@Global`](adr/0003-imports-explicitos-entre-modulos.md)
- [0004: Prettier formata e ESLint com tipos pega bugs, sem sobreposição](adr/0004-lint-e-formatacao.md)
- [0005: Aliases de import com `imports` do `package.json`](adr/0005-aliases-de-import-por-subpath-imports.md)
- [0006: Documentação em Diátaxis com roteamento para agentes](adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md)
- [0007: `AGENTS.md` como único arquivo de instruções](adr/0007-agents-md-como-unico-arquivo-de-instrucoes.md)
- [0008: Projeto template com módulos de exemplo](adr/0008-projeto-template-com-modulos-de-exemplo.md)
- [0009: Verificação do e-mail com o código no evento](adr/0009-verificacao-de-email-com-codigo-no-evento.md)
- [0010: Respostas de erro em Problem Details, com `type` `about:blank` e um `code`](adr/0010-erros-em-problem-details-com-code.md)
- [0011: Worktrees compartilham o stack do checkout principal, isolados por slot](adr/0011-worktrees-compartilham-o-stack-do-checkout-principal.md)
- [0012: Cadeia de suprimentos do CI: Dependabot, CodeQL, dependency review e lockfile das actions](adr/0012-cadeia-de-suprimentos-do-ci.md)
- [0013: Hooks do git com lefthook e commitlint no título do PR](adr/0013-hooks-do-git-com-lefthook-e-commitlint.md)
- [0014: Hook síncrono do tracing com `module.registerHooks`](adr/0014-hook-sincrono-do-tracing.md)
- [0015: Eventos pela outbox e por uma fila do BullMQ por consumidor](adr/0015-outbox-e-filas-por-consumidor.md)

## Fora dos quadrantes

- Planos (`docs/plan/`): trabalho interno em andamento, um arquivo por plano. Em andamento: o [roadmap das issues abertas](plan/roadmap-das-issues-abertas.md). Ao criar o primeiro, acrescente a rota "Continuar um plano em andamento" (`docs/plan/`) na tabela do `AGENTS.md`, e tire-a ao apagar o último. Um plano concluído ou descartado sai da pasta. O registro de um plano encerrado fica no histórico do git da `main` ou, se o plano nasceu e foi apagado no mesmo PR (o merge por squash descarta os commits da branch), num comentário da issue:

| Plano | Status | Registro |
| --- | --- | --- |
| Detecção de quebra do contrato OpenAPI | Concluído | [registro da issue #23](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/23#issuecomment-7180881367) |
| Hooks de pre-commit e do commitlint | Concluído | [registro da issue #22](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/22#issuecomment-7180712061) |
| Relatório de cobertura de testes | Concluído | [registro da issue #21](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/21#issuecomment-7179948024) |
| Métricas com OpenTelemetry | Concluído | [registro da issue #17](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/17#issuecomment-7179665823) |
| Rate limit do login por conta | Concluído | [registro da issue #19](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/19#issuecomment-7170252799) |
| Troca do `module.register` | Concluído | [registro da issue #15](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/15#issuecomment-7170040083) |
| Gatilho dos pacotes Nest pré-1.0 | Concluído | [registro da issue #16](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/16#issuecomment-7169483191) |
| Ambientes isolados por git worktree | Concluído | [registro da issue #35](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/35#issuecomment-7160950165) |
| Pool e timeouts do Postgres | Concluído | [registro da issue #18](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/18#issuecomment-7153307296) |
| Otimização do CI | Concluído | `git show 01f32ac:docs/plan/otimizacao-do-ci.md` (fases 1 e 2) e [registro da issue #14](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/14#issuecomment-7152733280) (fase 3) |
| Respostas de erro em Problem Details | Concluído | [registro da issue #11](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/11#issuecomment-7148591899) |
| Deploy com Docker | Concluído | [registro da issue #10](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/10#issuecomment-7147612651) |
| Projeto template (CI, verificação de e-mail e README) | Concluído | `git show 3a6d4dd:docs/plan/projeto-template.md`, até o passo 14 |
| Ciclo do pedido | Descartado antes de começar | `git show 5f4df0c:docs/plan/ciclo-do-pedido.md` |

## Como escrever uma página

1. Escolha o tipo pela tabela [Qual tipo de página](#qual-tipo-de-página). Se o texto pede dois tipos, são duas páginas, com link entre elas.
2. Gere a página: `npm run plop doc <tipo> "<nome em pt-BR>"`. No how-to, comece o nome pelo verbo (`"rodar as migrations"`). O gerador cria o arquivo na pasta certa, com o frontmatter `type:` igual à pasta e as seções do tipo.
3. Preencha as seções e apague os comentários do template. Um comentário que sobra é lido pelo agente como instrução.
4. Escreva de forma atemporal: sem "hoje", "atualmente" ou "novo". Data só em registro, por exemplo "consultado em 2026-11-23".
5. Ponha a página no índice acima. Se um agente precisa achá-la, acrescente uma linha na tabela de rotas do `AGENTS.md`, com o caminho em texto simples, sem `@`.
6. Rode `npm run docs:check`. Ele confere o lint do Markdown, os links e âncoras locais, o `type:`, os comentários de template e os caminhos citados nos arquivos de agente. Os links externos são conferidos com `npm run docs:links`.

Um ADR não sai do gerador. Use o próximo número e o formato das ADRs novas: `status: accepted`, "Considered Options" e "Consequences". As mais antigas podem não seguir esse formato.
