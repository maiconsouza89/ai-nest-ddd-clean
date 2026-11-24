# Plano de documentação: Diátaxis e roteamento para agentes

Este plano reorganiza a documentação do repositório em dois níveis:

- **Para humanos:** `docs/`, no modelo [Diátaxis](https://diataxis.fr/), com tutoriais, how-tos, referência e explicação.
- **Para agentes:** uma camada fina de roteamento (`AGENTS.md`, `CLAUDE.md`, `.claude/rules/` e `.claude/skills/`). Ela aponta para `docs/` e não repete conteúdo.

As decisões e as alternativas descartadas ficam registradas no ADR 0006, criado no passo 1. Este plano diz só **o que fazer** e **como validar**.

## Como usar

- Cada passo tem **Por quê**, **Faça** e **Pronto quando**.
- A fase termina quando todos os seus passos estão marcados e o checklist da fase, na seção [Validação da entrega](#validação-da-entrega), passa.
- Passos que mudam scripts, configuração ou templates do plop passam por `/simplify` e depois `/code-review`, como manda o fluxo de entrega. Passos só de texto pulam essa etapa e registram isso no "Como ficou".
- As fases 1 e 2 são entregas fechadas, um PR cada. A fase 3 é **sob demanda**: cada passo é feito quando o assunto for tocado, como o Diátaxis recomenda (melhorar aos poucos, em pedaços pequenos, sem reescrever tudo de uma vez).
- Não crie pastas vazias. Uma pasta de quadrante só nasce com a primeira página que entrar nela.
- Legenda: ⬜ não iniciada, 🟡 em andamento, ✅ concluída. Ao começar uma fase, marque 🟡 e preencha **Início**.

## Estrutura alvo

```text
README.md                         o que é, quickstart, mapa da documentação
AGENTS.md                         roteador neutro (qualquer agente)
CLAUDE.md                         @AGENTS.md + regras exclusivas do Claude
.claude/
  rules/modules.md                paths: src/modules/** → aponta para docs/reference/modules/<m>.md
  rules/<camada>.md               paths por camada → aponta para docs/reference/camadas.md
  skills/<procedimento>/SKILL.md  descrição com gatilho; o corpo aponta para docs/how-to/
docs/
  README.md                       índice por quadrante + bússola do Diátaxis
  tutorials/
  how-to/
  reference/
    comandos.md
    variaveis-de-ambiente.md
    versoes-e-excecoes.md
    convencoes.md
    autenticacao.md
    camadas.md
    glossario.md
    modules/<módulo>.md
  explanation/
  adr/                            fora dos quadrantes: registro imutável (MADR 4)
  plan/                           fora dos quadrantes: trabalho interno
plop-templates/doc/               um template por tipo
```

Convenções:

- Pastas em inglês, nomes de arquivo e conteúdo em pt-BR. A exceção são os docs de módulo, que usam o nome do módulo no código (`orders.md`).
- Toda página de quadrante tem frontmatter `type:` igual à pasta onde está: `tutorial`, `how-to`, `reference` ou `explanation`.
- Agentes citam `docs/` por caminho em texto simples. Não use `@docs/...`, porque o import carrega o arquivo em toda sessão.

## Mapa

| Fase | O que entrega | Status |
| --- | --- | --- |
| 1. Fundação | ADR 0006, `docs:check`, templates, referência operacional, `AGENTS.md`, `CLAUDE.md` enxuto, READMEs | ✅ |
| 2. Módulos e glossário | `docs/reference/modules/*.md`, `glossario.md`, regra-ponteiro, plop gera doc de módulo | ✅ |
| 3. Sob demanda | Camadas (check primeiro), divisão do guia de pesquisa, how-tos e skills, tutoriais | 🟡 |

---

## Fase 1: fundação

> **Status:** ✅ Concluída · **Início:** 2026-11-23 · **Conclusão:** 2026-11-23
>
> - [x] Passo 1: ADR 0006
> - [x] Passo 2: `docs:check` no CI
> - [x] Passo 3: templates `plop doc`
> - [x] Passo 4: referência operacional
> - [x] Passo 5: `AGENTS.md` e `CLAUDE.md` enxuto
> - [x] Passo 6: `README.md` e `docs/README.md`

### Passo 1: ADR 0006

**Por quê:** a estrutura passa nos três critérios para virar ADR. É cara de desfazer depois que os ponteiros se espalham, surpreende quem chega sem contexto e saiu de uma escolha entre alternativas reais.

**Faça:** crie `docs/adr/0006-documentacao-diataxis-e-roteamento-para-agentes.md` no formato dos ADRs existentes (`status: accepted`, "Considered Options", "Consequences"). Registre as decisões da discussão:

1. A doc é para humanos e agentes. Os agentes recebem uma camada de roteamento, não textos próprios.
2. `docs/` é a fonte da verdade. Os arquivos de agente citam caminhos em texto simples, e só um resumo de comandos aparece repetido.
3. O `AGENTS.md` é o roteador neutro, e o `CLAUDE.md` começa com `@AGENTS.md`. As alternativas foram usar só o `CLAUDE.md` ou um symlink.
4. O conhecimento de cada módulo fica em `docs/reference/modules/<m>.md`. As alternativas foram um `AGENTS.md` dentro do módulo ou regras com o conteúdo.
5. O agente descobre esse arquivo pela tabela de rotas no `AGENTS.md` e por uma única regra-ponteiro com `paths`.
6. Camadas: o que dá para verificar vira check, e o que exige julgamento vira texto com regras-ponteiro.
7. Procedimentos: o passo a passo fica em `docs/how-to/`, com skills-ponteiro para os mais frequentes.
8. A linguagem ubíqua fica numa seção de cada doc de módulo. O `glossario.md` guarda os termos compartilhados e um índice.
9. Pastas em inglês, arquivos em pt-BR.
10. `adr/` e `plan/` ficam fora dos quadrantes, e o `research/` é dividido entre eles.
11. `docs:check` no CI e uma definição de pronto no `AGENTS.md`.
12. Frontmatter `type:` obrigatório e páginas geradas pelo `plop doc`.
13. Entrega em três etapas: fundação, módulos e glossário, e o resto sob demanda.
14. Nenhum hook: as regras sem exceção continuam como texto.
15. Só Markdown, sem site gerado.

**Pronto quando:** o ADR existe, está linkado no `evolucao.md` (lista de ADRs no topo) e no `docs/README.md` (passo 6).

**Como ficou (2026-11-23):** ADR criado com as decisões agrupadas em seções (fonte da verdade, onde fica cada conhecimento, formato, verificação e entrega) e uma alternativa descartada para cada decisão que teve escolha real. Linkado no topo do `evolucao.md`. O link no `docs/README.md` entra no passo 6, que cria o arquivo. O passo 2 acrescentou as ferramentas do `docs:check` e o motivo do `.prettierignore`. Passo só de texto: `/simplify` e `/code-review` pulados.

### Passo 2: `docs:check` no CI

**Por quê:** a arquitetura de ponteiros só funciona se os caminhos citados existirem. Hoje o `*.md` está no `.prettierignore` (desde o commit `5f805e9`, que criou a configuração do Prettier sem registrar o motivo), e nada confere a documentação.

**Faça:**

- Escolha as ferramentas consultando o Context7, como pede a regra de dependências do `CLAUDE.md`, e registre a versão consultada:
  - **lint de Markdown:** `markdownlint-cli2` ou equivalente;
  - **links e âncoras locais, offline:** `remark-validate-links` (npm) ou `lychee --offline --include-fragments`. O lychee é um binário Rust e exigiria Docker ou instalação à parte.
- Um script `scripts/check-doc-types.mjs` confere duas coisas:
  - toda página em `docs/{tutorials,how-to,reference,explanation}/` tem `type:` igual à pasta;
  - nenhum `AGENTS.md` ou `CLAUDE.md` usa `@docs/` (a exceção permitida é `@AGENTS.md`).
- Crie `npm run docs:check`, cobrindo `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/**` e `.claude/**`, e inclua no `npm run ci`.
- Descubra por que o `*.md` foi excluído do Prettier. Se não houver motivo, inclua o Markdown no `format:check`. Se houver, registre o motivo no ADR 0006.
- Links externos ficam fora do CI. Documente o comando para checá-los sob demanda em `reference/comandos.md`.

**Pronto quando:** `npm run ci` passa, e quebrar de propósito um link, uma âncora ou um `type:` faz o `docs:check` falhar com mensagem clara.

**Como ficou (2026-11-23):**

- **Ferramentas:** `markdownlint-cli2` 0.24.2, consultado no Context7 (`/davidanson/markdownlint-cli2`, v0.24.0). `remark-cli` 12.0.1 com `remark-validate-links` 13.1.0, `remark-frontmatter` 5.0.0 e `remark-gfm` 4.0.1. O Context7 não tem o `remark-validate-links`, então a fonte foi o README do pacote no npm, e o `remark-cli` foi conferido no Context7 (`/remarkjs/remark`). Todas na latest. O lychee ficou só para os links externos.
- **Arquivos:** todo `*.md` que o `.gitignore` não exclui, nas duas ferramentas e no lychee. Assim um `CLAUDE.md` dentro de um módulo também entra. O `.claude/worktrees/` foi para o `.gitignore`, para os worktrees do Claude Code não serem conferidos em dobro.
- **Configuração:** `.markdownlint-cli2.jsonc` com o `MD013` desligado, o `MD024` só entre irmãos e o `MD041` desligado no `CLAUDE.md` (motivos no ADR 0006). `.remarkrc.json` com `repository: false`, porque o repositório não tem remote. Os 17 rótulos em negrito que o `MD036` apontava no guia de pesquisa e no `passo-a-passo.md` eram títulos de fato e viraram títulos.
- **Regras do projeto:** um plugin do remark, `scripts/remark-docs-rules.mjs`, no lugar do `scripts/check-doc-types.mjs`. Ele usa a árvore do remark, que já separa código de texto, e o mesmo conjunto de arquivos. Ele faz três coisas:
  - confere o `type:` das páginas de quadrante;
  - barra qualquer `@caminho` (com `/` ou extensão) nos `AGENTS.md` e `CLAUDE.md`, exceto o `@AGENTS.md` no `CLAUDE.md`. É o item "os únicos imports com `@`" do checklist;
  - confere se cada caminho de `docs/` citado em texto ou entre crases nos arquivos de agente e em `.claude/` existe. Placeholders como `<módulo>` são pulados. Sem isso, os ponteiros em texto simples prescritos pelo ADR não seriam validados.
- **Prettier:** havia motivo, registrado no `evolucao.md` (passo 4 da fase 2): o Prettier alinharia as tabelas. Na conferência, ele mudaria 6 arquivos, com linhas de tabela acima de 300 caracteres. O `*.md` continua no `.prettierignore`, e o motivo foi para o ADR 0006.
- **Links externos:** `npm run docs:links` roda o lychee via Docker (`--scheme https --scheme http`). Rodado em 2026-11-23: 43 OK, 0 erros. O passo 4 o documenta em `reference/comandos.md`.
- **O que o check encontrou:** 13 links quebrados no `passo-a-passo.md` (`research/...` no lugar de `../research/...`), corrigidos. Também 5 blocos de código sem linguagem (MD040), que viraram `text`.
- **Testes negativos:** cada caso falhou com mensagem clara e foi desfeito depois. Os casos foram:
  - link quebrado;
  - âncora quebrada em outro arquivo;
  - `type:` errado e página sem frontmatter;
  - `@docs/` e `@package.json` no `AGENTS.md`;
  - caminho de `docs/` inexistente em texto simples e entre crases;
  - `@docs/` num `CLAUDE.md` aninhado;
  - ponteiro e link quebrados em `.claude/rules/`.

  Passaram sem aviso: e-mail, `@` entre crases ou em bloco de código, `@fulano`, um placeholder `<m>` e um arquivo quebrado dentro de `.claude/worktrees/`. O `npm run ci` passa.
- **`/simplify`:** quatro revisores. O resultado foi o plugin no lugar do script, a lista única de arquivos, o `.claude/worktrees/` no `.gitignore`, o `MD036` religado (o motivo registrado antes estava errado, porque o `MD036` já ignora rótulos com `:`) e a validação dos ponteiros em texto simples. Ficaram de fora o cache do lychee e rodar as ferramentas em paralelo: cerca de 0,4 s num `ci` de cerca de 21 s, e exigiria uma dependência nova.
- **`/code-review`:** corrigiu três falsos positivos que quebrariam o CI: ponteiro com âncora ou linha (`docs/x.md#secao`, `docs/x.md:12`), ponteiro no fim de pergunta (`?`, `!`) e `type:` entre aspas ou com comentário. Também passaram a ser conferidos os ponteiros `./docs/...` e `../docs/...`, o `CLAUDE.local.md` e as pastas `.claude/` aninhadas. O ESLint passou a cobrir `scripts/**/*.mjs`, e o `CLAUDE.md` cita o `docs:check` e o `docs:links`. A imagem do lychee não foi fixada: a regra de versões pede a latest, e o comando roda só sob demanda.

### Passo 3: templates `plop doc`

**Por quê:** a página nasce com o formato do seu tipo, e o agente não precisa adivinhar a estrutura.

**Faça:** crie `plop-templates/doc/{tutorial,how-to,reference,explanation}.md.hbs` e um gerador `doc` no `plopfile.mjs`, chamado com `npm run plop doc <tipo> <nome>`. Cada template:

- **tutorial:** objetivo, o que você vai construir, pré-requisitos, passos numerados com o resultado esperado em cada um, e o que você aprendeu.
- **how-to:** título "Como …", pré-requisitos, passos, como verificar e "Veja também".
- **reference:** descrição em uma frase e tabelas ou listas secas, sem passo a passo nem opinião.
- **explanation:** contexto, o porquê, alternativas e trade-offs, e links para os ADRs.

**Pronto quando:** o gerador cria uma página de cada tipo, e as quatro passam no `docs:check`. Apague as páginas de teste depois.

**Como ficou (2026-11-23):**

- **Uso:** `npm run plop doc <tipo> "<nome>"`, consultado no Context7 (`/plopjs/plop`, bypass de prompts por posição). O nome dá o título e o arquivo sem acento: `"variáveis de ambiente"` → `docs/reference/variaveis-de-ambiente.md`, com título "Variáveis de ambiente". No how-to, o título vira "Como …", e um "como" digitado não se repete nem entra no arquivo: `"Rodar as migrations"` → "Como rodar as migrations", em `rodar-as-migrations.md`. Siglas ficam como estão ("Como configurar a API do JWT"). O plop recusa sobrescrever uma página que já existe e rejeita tipo inválido.
- **Mapa de quadrantes:** o plopfile deriva o mapa do `quadrantTypes` do `scripts/remark-docs-rules.mjs`. O gerador e o `docs:check` não têm como divergir.
- **Templates:** cada seção pedida tem um comentário HTML com o que escrever nela, e a abertura diz em uma linha o que fica fora do quadrante.
- **Mudança no "Pronto quando":** o `docs:check` passou a barrar comentários de template que sobram numa página de quadrante (regra `scaffold`, menos os comentários `markdownlint-`). O Claude Code só remove comentários do `CLAUDE.md` e do `AGENTS.md`. Nas páginas de `docs/`, um comentário esquecido viraria instrução velha em toda leitura de agente. Por isso a página recém-gerada **falha** no `docs:check` (21 avisos `scaffold` nas quatro, e nenhum outro). Com os comentários apagados, as quatro passam. As páginas de teste foram apagadas.
- **`/simplify`:** quatro revisores. Daí saíram o mapa único, uma variável só para o título e o arquivo, os comentários mais curtos e a regra `scaffold`. A regra dos termos datados ("hoje", "atualmente") vale para toda página, não só para a referência. Ela saiu do template e vai para o "Como escrever uma página" do passo 6. O passo 7 também foi corrigido: o `FILES` do gerador `module` só serve para destinos em `src/modules/<m>/`.
- **`/code-review`:** corrigiu quatro pontos:
  - um how-to chamado só "como", com o tipo escolhido depois do nome (`plop doc _ como`), gerava `docs/how-to/.md`. As actions agora param com erro;
  - a regra `scaffold` não pegava comentário recuado ou dentro de um bloco HTML;
  - o "como" seguido de pontuação ("Como: rodar") não saía;
  - o `slugify` apagava sinais soltos (`^`, `´`) em vez de virá-los `-`.

  A primeira palavra do how-to continua em minúscula, menos siglas, e o prompt pede para começar pelo verbo.

### Passo 4: referência operacional

**Por quê:** hoje o `CLAUDE.md` é a única cópia dos comandos, do setup e das convenções. Um humano sem o Claude não tem onde encontrá-los.

**Faça:** mova o conteúdo conforme a tabela abaixo. Mover significa que o texto sai do `CLAUDE.md` e vai para `docs/`. O `AGENTS.md` só resume ou aponta (passo 5).

| Seção atual do `CLAUDE.md` | Destino |
| --- | --- |
| Comandos, setup do zero, migrations, seeds, testes, novo módulo | `docs/reference/comandos.md` |
| Variáveis citadas (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_TTL_SECONDS`, `NODE_ENV`) | `docs/reference/variaveis-de-ambiente.md`, partindo do `.env.example` e da validação de env |
| Regra de versões | `docs/reference/versoes-e-excecoes.md`. A tabela de exceções **sai** do `evolucao.md`, que passa a apontar para cá |
| Imports (ESM), aliases `#...`, `import type`, `import.meta.dirname` | `docs/reference/convencoes.md` |
| Autenticação (rotas, payload, TTL, refresh, logout) | `docs/reference/autenticacao.md`. O porquê continua no ADR 0002 |
| Arquitetura (visão geral) | Um parágrafo no `README.md` com link para o guia de pesquisa, até a fase 3 dividi-lo |

Escreva de forma atemporal: sem "hoje", "atualmente" ou "novo". Data só em registro, por exemplo "consultado em 2026-11-23".

**Pronto quando:** cada fato da tabela existe em `docs/` com `type: reference`, e o `evolucao.md` aponta para `versoes-e-excecoes.md` em vez de manter a tabela.

**Como ficou (2026-11-23):**

- **Páginas:** `comandos.md`, `variaveis-de-ambiente.md`, `versoes-e-excecoes.md`, `convencoes.md` e `autenticacao.md`, em `docs/reference/`. Cada fato foi conferido contra o código (`package.json`, `env.validation.ts`, `test/setup-env.ts`, `app.module.ts`, `app.setup.ts`, os controllers e use cases do identity e os guards do shared), não só copiado do `CLAUDE.md`.
- **Além do `CLAUDE.md` antigo:** as variáveis de ambiente estão todas, não só as quatro citadas, com padrão, valores aceitos e efeito; as regras de carga (`.env.local`, `.env`, produção só com o ambiente, variável renomeada barra a subida); o `/health/ready`; o loop de migrations e seeds do setup; o `plop doc`; os limites de rate limit, os corpos e os códigos de erro das rotas de autenticação; o 403 do `@Roles`; e o job diário que apaga refresh tokens vencidos.
- **`evolucao.md`:** a tabela de exceções saiu. A seção "Regra de versões" e o passo 2 apontam para `versoes-e-excecoes.md`. O gatilho do `ioredis` levou junto o que revisar quando ele for para o 6.
- **`CLAUDE.md` provisório:** as seções movidas viraram uma lista de ponteiros, e a regra do `docker compose down` ficou por extenso, por ser regra sem exceção. As regras "bibliotecas oficiais primeiro" e "informe a versão consultada" foram para `versoes-e-excecoes.md`, que vale para qualquer pessoa. O passo 5 reescreve o arquivo.
- **Desvio:** a visão geral da arquitetura continua no `CLAUDE.md`. O destino é o `README.md`, que nasce no passo 6.
- **`/simplify` e `/code-review`:** pulados. O passo só mexe em Markdown.

### Passo 5: `AGENTS.md` e `CLAUDE.md` enxuto

**Por quê:** o arquivo raiz carrega em toda sessão. A doc do Claude Code recomenda menos de 200 linhas e só o que o agente não deduz lendo o código.

**Faça:**

- **`AGENTS.md`**, com meta de até 100 linhas:
  - projeto em três linhas;
  - comandos de verificação: `typecheck`, `lint`, `test`, um arquivo, `ci`, `arch`;
  - armadilhas:
    - imports relativos com `.js` e aliases entre fronteiras;
    - nada de `import type` em classe injetada;
    - `"mig:${m}:run"` no zsh;
    - a condição `@app/source`;
    - as migrations não rodam ao subir a app;
    - o e2e grava no banco e conflita com um `start:dev` aberto;
    - `docker compose down -v` só neste repo, nunca `prune`;
    - o oxc usa `Object` em tipos inferidos;
  - regra de versões em uma linha, apontando para `docs/reference/versoes-e-excecoes.md`;
  - definição de pronto: "uma mudança de comportamento atualiza a página do quadrante afetado, ou o PR diz por que não precisa";
  - **tabela de rotas** ("vai fazer X → leia Y"), apontando para `docs/` por caminho em texto simples.
- **`CLAUDE.md`**: `@AGENTS.md` na primeira linha. Depois, só o que é do Claude: pesquisa com o Context7 e o fluxo de entrega (`/simplify` → `/code-review`).
- Use comentários HTML (`<!-- -->`) para notas de manutenção. O Claude Code os remove antes de pôr o arquivo no contexto.

**Pronto quando:** `CLAUDE.md` com o `AGENTS.md` expandido fica abaixo de 200 linhas, nenhum fato do `CLAUDE.md` antigo se perdeu (confira item a item contra a tabela do passo 4), e o checklist da fase 1 passa.

**Como ficou (2026-11-23):**

- **Tamanho:** `AGENTS.md` com 53 linhas e `CLAUDE.md` com 22, ou 75 com o import expandido.
- **`AGENTS.md`:** projeto (com a visão geral da arquitetura, que saiu do `CLAUDE.md`), verificação, sete armadilhas, versões, definição de pronto e a tabela de rotas. A definição de pronto ganhou "`npm run ci` passa", e a verificação diz quando rodar integração e e2e, que o `ci` não cobre. As armadilhas de imports e de `import type` ficaram numa linha cada, com o detalhe em `convencoes.md`.
- **`CLAUDE.md`:** `@AGENTS.md`, depois só o Context7 e o fluxo de entrega. A linha "This file provides guidance…" saiu, por não mudar o comportamento.
- **Rotas:** só apontam para páginas que existem. Camadas e DDD vão para o guia de pesquisa até as fases 2 e 3. "Escrever ou mover documentação" aponta para o ADR 0006 até o `docs/README.md` existir (passo 6).
- **Nenhum fato perdido:** cada termo característico do `CLAUDE.md` anterior ao passo 4 (versões, portas, comandos, `remove-orphans`, `"mig:${m}:run"`, `Senha@12345`, oxc, `consistent-type-imports`, `ActorResolver`, `@Global`, `tracing.ts` e outros) foi procurado no `AGENTS.md`, no `CLAUDE.md` e em `docs/reference/`, e todos foram achados.
- **Teste de roteamento:** a primeira rodada da pergunta do pay-order misturou integração e e2e. A seção de verificação do `AGENTS.md` passou a dizer que o `test:int` sobe Postgres e Redis próprios (Testcontainers) e que só o `test:e2e` usa o docker-compose. Resultado no checklist da fase 1.
- **`/simplify` e `/code-review`:** pulados. O passo só mexe em Markdown.
- **Checklist da fase 1:** os itens automáticos e de conteúdo passam (marcados abaixo). Os de uso real dependem do `README.md` do passo 6 e de uma sessão nova, e ficam para o fim da fase.

### Passo 6: `README.md` e `docs/README.md`

**Por quê:** o repositório não tem porta de entrada.

**Faça:**

- **`README.md`:** o que é o projeto (um parágrafo, com a visão geral da arquitetura que o passo 4 deixou no `CLAUDE.md`), requisitos, quickstart com os passos numerados do setup (cada um com link para `docs/reference/comandos.md`) e um mapa da documentação.
- **`docs/README.md`:** a bússola do Diátaxis (ação ou conhecimento, adquirir ou aplicar), um índice por quadrante com só as páginas que existem, a lista de ADRs e uma seção "Como escrever uma página" (`npm run plop doc`, `type:`, `docs:check`, apagar os comentários do template, nada de "hoje", "atualmente" ou "novo", e data só em registro).
- **Rota do `AGENTS.md`:** "Escrever ou mover documentação" passa a apontar para o `docs/README.md`.

**Pronto quando:** alguém sem contexto chega do `README.md` à app rodando seguindo só links, e o `docs/README.md` lista todas as páginas existentes.

**Como ficou (2026-11-23):**

- **`README.md`:** o projeto em um parágrafo (módulos, `shared`, contratos e eventos pela outbox, composição), a stack, requisitos, um quickstart de seis passos com link para `comandos.md` em cada um, "Antes de abrir um PR" (o `ci` e a definição de pronto) e o mapa da documentação.
- **`docs/README.md`:** a bússola do Diátaxis em tabela, uma linha por tipo, o índice da referência (os outros quadrantes ainda não têm página), os seis ADRs, o que fica fora dos quadrantes (guia de pesquisa e planos) e "Como escrever uma página" em seis passos, com a regra de pôr a página no índice e, se um agente precisa achá-la, na tabela de rotas do `AGENTS.md`. O ADR fica de fora do gerador, com o formato a copiar.
- **`AGENTS.md`:** a rota "Escrever ou mover documentação" aponta para o `docs/README.md`.
- **Setup do zero:** feito num git worktree, com outro nome de projeto do compose, logo com volumes novos, e sem `.env`, seguindo só o quickstart. `npm install`, `cp .env.example .env`, `docker compose up -d postgres redis` (os dois `healthy`), os loops do `README.md` no zsh (todas as migrations dos cinco módulos e os três seeds, exit 0) e `npm run start:dev`, no ar em 9 s. `/health/live` e `/health/ready` deram 200, `/docs` deu 200, e o login do `admin@example.com` devolveu `accessToken`, `expiresIn=900` e `refreshToken`. No log, só o DEP0205 já registrado no passo 18 do `evolucao.md`. O projeto de teste foi removido com `docker compose down -v --remove-orphans` e o worktree apagado.
- **Achado do setup:** o npm 11.20 avisa que seis pacotes têm scripts de instalação não aprovados (`argon2`, `ssh2` e outros). O setup funciona sem aprová-los, e isso ficou escrito em `comandos.md` e no quickstart, para quem chega não travar no aviso.
- **`/simplify` e `/code-review`:** pulados. O passo só mexe em Markdown.

---

## Fase 2: módulos e glossário

> **Status:** ✅ Concluída · **Início:** 2026-11-23 · **Conclusão:** 2026-11-23
>
> - [x] Passo 7: template de módulo e `plop module`
> - [x] Passo 8: um doc por módulo
> - [x] Passo 9: `glossario.md`
> - [x] Passo 10: regra-ponteiro e rotas

### Passo 7: template de módulo e `plop module`

**Por quê:** todo módulo novo nasce com a sua doc, e a referência não fica para depois.

**Faça:** crie `plop-templates/doc/module.md.hbs` (`type: reference`) com estas seções:

- propósito, em uma frase;
- linguagem ubíqua;
- contrato público (facade e o que ela devolve);
- eventos publicados (nome, versão, exemplo em `contracts/events/*.example.ts`);
- eventos consumidos;
- invariantes;
- dependências (`imports`);
- schema e migrations;
- links para os ADRs.

Acrescente ao gerador `module` uma action `add` própria, com destino em `docs/reference/modules/{{kebabCase name}}.md`. A lista `FILES` não serve: ela prefixa o template com `plop-templates/module/` e o destino com `src/modules/<m>/`.

**Pronto quando:** `npm run plop module teste` gera a doc junto com o código, e a doc passa no `docs:check`. Desfaça o módulo de teste depois.

**Como ficou (2026-11-23):**

- **Template:** `plop-templates/doc/module.md.hbs`, com as seções pedidas e mais as rotas HTTP dentro de "Contrato público". O que o gerador sabe já vem escrito: nome do módulo, rotas do CRUD gerado, schema, tabela, tabela de migrations e scripts `mig:<nome>:*`. O resto tem comentário de template.
- **Gerador:** uma action `add` própria, fora do `FILES`, e uma `modify` que acrescenta o módulo à lista "Módulos" do `docs/README.md`. O plop recusa o nome se a pasta do módulo ou a doc já existirem, antes de gravar qualquer arquivo. A conferência do índice roda por último, para um índice fora do padrão não impedir os scripts de migration.
- **Mudança no "Pronto quando":** como no `plop doc` (passo 3), a doc recém-gerada falha no `docs:check`, só pela regra `scaffold` (7 avisos). Com os comentários apagados, ela passa. `npm run plop module teste-doc` rodado duas vezes (antes e depois do `/simplify`) e desfeito.
- **Regra nova no `docs:check` (`module-doc`):** todo diretório de `src/modules/` precisa de link para `reference/modules/<m>.md` no `docs/README.md`, e toda página em `docs/reference/modules/` precisa de um módulo com o mesmo nome. O link resolvido, que o `remark-validate-links` confere, garante que a página existe. Os dois casos foram testados de propósito (módulo sem doc, doc sem módulo).
- **`/simplify`:** quatro revisores. Daí saíram a regra `module-doc` e a entrada no índice pelo gerador, a doc do `orders` com as transições só no "Ciclo de vida" (com evento e erro), a coluna "Consumido por" no lugar da tabela de consumidores repetida, o índice do glossário só com termo e link, e a rota do guia de pesquisa no `AGENTS.md` restrita a criar algo novo, para uma mudança num módulo existente não carregar o guia inteiro (78 KB). Ficaram de fora a linha do ADR 0003 em cada doc (curta, aponta para a regra), as linhas derivadas do nome do módulo (caminhos e scripts, úteis para navegar) e links do glossário para o guia de pesquisa (o passo 15 o remove).
- **`/code-review`:** corrigiu a ordem das actions (a conferência do índice impedia os scripts de migration), a regra `module-doc` para aceitar `./reference/...` e links por referência, o `GET` gerado na doc (devolve `{ id, name }`), a ordem real das checagens ao fechar o pedido e a promessa de e-mail único do notifications. Ficou de fora a recusa de outras páginas em `docs/reference/modules/`: a pasta só tem docs de módulo.
- **Lacuna conhecida:** nada confere se cada facade e evento de `contracts/` aparece na doc do módulo. A regra-ponteiro pede para mudar a doc junto. Um check por nome de arquivo fica para quando um contrato novo escapar.

### Passo 8: um doc por módulo

**Por quê:** é onde o agente mais ganha ao navegar o código.

**Faça:** escreva `orders`, `catalog`, `inventory`, `identity` e `notifications`, sempre a partir do código e nunca de memória. Resolva os termos que ficaram abertos na discussão:

- `User` (identity), `Actor` (shared) e `Customer` (`customerId` em orders) são três conceitos diferentes? Cenário: um admin age sobre o pedido de outro usuário.
- `OrderCreated` (rascunho `DRAFT`) e `OrderPlaced` (`DRAFT` → `PLACED`): confirme os dois momentos e defina os verbos "criar" e "fechar".
- O `catalog` não segue as pastas `domain/`, `application/` e `infra/`. Registre se é intencional, por ser um módulo CRUD simples, e por quê.

**Pronto quando:**

- os cinco docs existem;
- cada facade e cada evento em `contracts/` aparece no doc do seu módulo;
- cada termo da seção "Linguagem ubíqua" é usado com o mesmo nome no código ou tem a diferença explicada.

**Como ficou (2026-11-23):**

- **Docs:** `docs/reference/modules/{orders,catalog,inventory,identity,notifications}.md`, escritos a partir do código: módulos Nest, contracts, entidades, casos de uso, filtros de erro, handlers, jobs, migrations e seeds. O `identity` aponta para `autenticacao.md` em rotas, tokens e prazos, sem repeti-los.
- **`User`, `Actor` e `Customer`:** três conceitos. Usuário é a conta (identity), ator é quem faz a requisição (shared, carregado a cada requisição) e cliente é o dono do pedido (`customerId`, o id do usuário que o criou). No cenário do admin que cancela o pedido de outro, o ator é o admin, e o cliente continua o dono. Definidos na seção "Usuário, ator e cliente" do glossário.
- **`OrderCreated` e `OrderPlaced`:** dois momentos. "Criar" abre o pedido em `DRAFT` já com os itens e os preços do catalog. "Fechar" (`place()`) reserva o estoque e passa a `PLACED`, e depois disso os itens não mudam.
- **`catalog`:** CRUD intencional, pelo "Nem todo módulo precisa de DDD" do guia e pelo comentário do `products.service.ts`. Registrado na seção "Estrutura" da doc. O `inventory` também não tem entidade (as regras são operações atômicas no repositório), e o `notifications` não tem `domain/`. As duas docs dizem isso.
- **Achados no código, fora do escopo de docs:** um id que não é uuid em `/v1/orders/:id/*` ou num `productId` do `POST /v1/orders` chega a uma coluna `uuid` e responde 500, não 404. No catalog, um nome só com espaços passa na validação (`@Length` antes do `trim`) e é gravado vazio. As docs descrevem o comportamento pretendido.
- **`/simplify` e `/code-review`:** ver o passo 7, que os rodou sobre a fase toda.

### Passo 9: `glossario.md`

**Por quê:** alguns termos atravessam os módulos: `Actor`, facade, evento de domínio e evento de integração, outbox, idempotency key, shared kernel.

**Faça:** crie `docs/reference/glossario.md` com duas partes:

- os termos compartilhados, definidos sem detalhe de implementação;
- um índice A–Z de todos os termos, com link para a seção do módulo dono.

Quando o mesmo termo tiver sentidos diferentes em módulos diferentes, liste os dois e diga em qual contexto vale cada um.

**Pronto quando:** todo termo das seções "Linguagem ubíqua" está no índice, e todo link do índice resolve, conferido pelo `docs:check`.

**Como ficou (2026-11-23):** termos compartilhados (usuário, ator e cliente, agregado, evento de domínio e de integração, outbox, consumidor, consumidor idempotente, idempotency key, facade, port e adapter, contrato, shared kernel, dinheiro, concorrência otimista), "Mesmo termo, sentidos diferentes" (o `Email` do identity e o do notifications) e o índice, com termo e link. Os 29 termos das cinco docs estão no índice, conferidos por script. "Criar" e "Status" entram como "Criar (pedido)" e "Status (do pedido)". O `docs:check` resolve todos os links e âncoras, e uma âncora quebrada de propósito falhou.

### Passo 10: regra-ponteiro e rotas

**Por quê:** nada da doc de módulo carrega sozinho. A regra faz o Claude abrir o arquivo certo, e a tabela do `AGENTS.md` cobre os outros agentes.

**Faça:**

- Crie `.claude/rules/modules.md` com `paths: ["src/modules/**"]` e duas linhas: "Antes de alterar um módulo, leia `docs/reference/modules/<módulo>.md`. Para termos compartilhados, `docs/reference/glossario.md`."
- Acrescente as linhas correspondentes à tabela de rotas do `AGENTS.md`.

**Pronto quando:** numa sessão nova, `/context` mostra que a regra **não** carregou no início e **passa** a carregar depois de ler um arquivo em `src/modules/orders/`.

**Como ficou (2026-11-23):** `.claude/rules/modules.md` com `paths: ["src/modules/**"]`. Ela manda ler a doc do módulo e mudá-la junto com o código, e cita o glossário só para um termo que não está na doc. O `AGENTS.md` ganhou as rotas "Mudar um módulo existente" e "Entender um termo do domínio". O índice do `docs/README.md` ganhou o glossário e a seção "Módulos", e o `README.md` e o `comandos.md` citam as docs de módulo. Numa sessão nova, a regra só entrou no contexto depois do Read de um arquivo em `src/modules/`. Grep e `ls` não a carregaram. O `/context` e o `/memory` não listam regras, então a conferência foi feita perguntando à sessão (ver o checklist da fase).

---

## Fase 3: sob demanda

> **Status:** 🟡 Em andamento · **Início:** 2026-11-23 · **Conclusão:** —
>
> - [x] Passo 11: camadas (check primeiro)
> - [x] Passo 12: dividir o guia de pesquisa
> - [ ] Passo 13: how-tos e skills-ponteiro (parcial: how-tos prontos, skills adiadas)
> - [x] Passo 14: tutoriais
> - [x] Passo 15: remover `docs/research/`

Cada passo desta fase é feito quando o assunto for tocado. O passo pode ficar marcado parcialmente, com uma nota do que já foi feito.

### Passo 11: camadas (check primeiro)

**Por quê:** uma regra verificada por ferramenta ensina o agente pela mensagem de erro e não depende de ele ler a doc.

**Faça:**

- Liste as convenções de camada do guia de pesquisa (domain sem Nest e sem TypeORM, application só com ports, infra com adapters, etc.).
- Para cada uma, decida:
  - **dá para verificar** → vira regra do dependency-cruiser ou do ESLint, com mensagem que cita a doc;
  - **exige julgamento** → vai para `docs/reference/camadas.md`.
- Crie regras-ponteiro por camada (`.claude/rules/domain.md` com `paths: ["src/**/domain/**"]`, e o mesmo para as outras camadas) apontando para a seção certa de `camadas.md`.

**Pronto quando:** cada convenção está como check ou como texto (nunca nos dois), e uma violação de propósito em `domain/` falha no `npm run arch` ou no `npm run lint`.

**Como ficou (2026-11-23):**

- **Checks no `arch`:** a regra que barrava só `@nestjs` e `typeorm` em domain e application virou `camadas-internas-sem-pacotes`. Ela vale também para o contracts e barra qualquer pacote npm ou módulo do Node (`dependencyTypesNot: ['local']`). Os 94 arquivos dessas camadas não importavam nenhum. Um pacote puro entra por `pathNot`. Regras novas: `porta-de-entrada-sem-persistencia` (`infra/http`, `infra/jobs` e `infra/events` de um módulo sem repositório, sem `infra/database` e sem TypeORM) e `shared-nao-importa-modulos` (o alias `#modules/...` passava pela `fronteira-via-alias`). Toda regra ganhou um `comment` com o que barra, como consertar e a doc, e o `arch` passou a usar `--output-type err-long`, que imprime esse comentário.
- **Check no `lint`:** em `domain/repositories`, `application/ports`, `application/queries` e `contracts/*.facade.ts`, uma `interface` ou um `type` com método falha. Contrato é `abstract class`, para servir de token de injeção.
- **Texto:** `docs/reference/camadas.md`, com o que fica em cada camada e em qual pasta, para o que nenhuma ferramenta confere. Ela não repete o que as regras barram.
- **Regra-ponteiro:** uma só, `.claude/rules/camadas.md`, com os caminhos das quatro camadas, mandando ler a seção da camada. Quatro arquivos quase iguais apontariam para a mesma página curta. Rotas: uma linha no `AGENTS.md` e uma no índice do `docs/README.md`.
- **Guia de pesquisa:** a cópia das regras do dependency-cruiser em "Regras de arquitetura no CI" virou ponteiro para o `.dependency-cruiser.js` e para `camadas.md`. O resto da seção "Camadas" fica para o passo 12.
- **Teste negativo:** um import de `@nestjs/common` e de `node:crypto` em `domain/`, um alias para `#modules/...` no shared, um controller importando repositório e TypeORM, e uma `interface` e um `type` com método num port. Cada um falhou com a sua mensagem, e um `type` só de dados e um job do shared usando `infra/database` passaram. Todos desfeitos depois.
- **`/simplify`:** quatro revisores. Daí saíram o `dependencyTypesNot: ['local']` no lugar da lista de oito tipos, a âncora da porta de entrada em `src/modules/` (pegava `shared/infra/jobs`), o TypeORM barrado também na porta de entrada, o `type` com método barrado no lint, a constante `CONVENCOES`, o mapa da página só com o papel de cada camada, e o corte das frases que repetiam um check, o glossário ou um porquê. Ficaram de fora o resto da seção "Camadas" do guia (passo 12), o `convencoes.md`, que também repete as regras de alias (fora deste passo), e a mensagem dobrada quando um import cai em duas regras de propósitos diferentes.
- **`/code-review`:** o lint passou a barrar também o `type` com propriedade de função (`save: () => …`), que escapava do seletor de método. Ajustes de texto: a página e a regra-ponteiro dizem que o `lint` confere a forma dos contratos, não imports; a página ganhou a linha de value object; o `comment` da porta de entrada cita a persistência do shared, que a regra também barra; o `comment` do contracts perdeu a frase sobre o retorno da facade, que fica só no texto; e o guia cita o `npm run arch`, que imprime os comentários.

### Passo 12: dividir o guia de pesquisa

**Por quê:** as 1474 linhas misturam os quatro quadrantes. Destinos sugeridos (confirme ao dividir):

| Seção do guia | Destino |
| --- | --- |
| Visão geral | `explanation/arquitetura.md` |
| Estrutura de pastas | `reference/camadas.md`, seção "Estrutura de pastas" (era `reference/estrutura-de-pastas.md`) |
| Camadas | `reference/camadas.md` (regras) e `explanation/arquitetura.md` (porquê) |
| Persistência com TypeORM | `explanation/persistencia.md` e `reference/convencoes.md`, seção "TypeORM" |
| Módulos independentes; dependências e contratos | `explanation/comunicacao-entre-modulos.md`, `how-to/gerar-uma-migration.md`, `reference/camadas.md` ("Entre módulos" e "Contracts") e `reference/convencoes.md` (versão da API HTTP) |
| Shared kernel | `explanation/shared-kernel.md` (a tabela do que vai para o `shared` já estava em `reference/camadas.md`) |
| Autenticação e ownership | `explanation/autenticacao.md` (o `reference/autenticacao.md` já existe) |
| Agregados e comunicação entre módulos | `explanation/agregados.md` |
| Transações, concorrência e eventos | `explanation/consistencia-e-eventos.md` e `how-to/publicar-um-evento-de-integracao.md` |
| Paginação | `how-to/paginar-uma-listagem.md` |
| Modelagem do domínio | `explanation/modelagem-do-dominio.md` |
| Infra: configuração, jobs, cache, serviços externos | how-tos por tarefa e `reference/variaveis-de-ambiente.md` |
| Qualidade | `reference/testes.md` e `explanation/observabilidade.md` (era `reference/qualidade.md`) |
| Operação | `reference/operacao.md` e `explanation/comunicacao-entre-modulos.md` ("Extrair um módulo para um serviço") |
| Pragmatismo e checklist | `explanation/pragmatismo.md` e `how-to/revisar-um-modulo.md` |
| Referências | Seção "Leituras" no `docs/README.md` |

**Faça:** uma seção por vez:

1. Gere a página com o `plop doc`.
2. Mova o texto e divida o que mistura tipos.
3. Confira cada trecho de código contra o código atual.
4. No guia, troque a seção por um link para o novo destino.
5. Atualize a tabela de rotas do `AGENTS.md`.

**Pronto quando:** a seção virou link no guia, a página nova passa no `docs:check` e aparece no índice do `docs/README.md`.

**Como ficou (parcial):**

- **Visão geral e Camadas (2026-11-23):** as duas foram para `docs/explanation/arquitetura.md`, a primeira página do quadrante de explicação. As regras de camada já estavam em `reference/camadas.md` desde o passo 11, então a página ficou só com o porquê: o que torna o sistema um monólito modular, a regra de dependência, o Nest só na infra (`abstract class` como token, `useFactory` no módulo), o papel da entidade, do caso de uso e do controller, e as alternativas descartadas (microsserviços desde o início, `@Injectable()` no caso de uso, `interface` como contrato, uma entidade só para domínio e ORM). Os trechos de código foram conferidos contra o orders e atualizados: o `CreateOrderUseCase` ganhou outbox, clock e transação, o módulo ganhou os imports do inventory e do messaging, e o controller, o `@UseFilters`. No guia, as duas seções viraram ponteiro, com o título mantido para não quebrar âncoras. O link do `passo-a-passo.md` para `#camadas` aponta para as páginas novas. A linha "Versões de referência" saiu: as versões estão no `package.json`, e a incompatibilidade do `@nestjs/typeorm` 10 e 11.0.0 com o TypeORM 1.x foi para "Combinações que quebram" em `versoes-e-excecoes.md`. Rota nova no `AGENTS.md`, entrada nova no índice do `docs/README.md` e no mapa do `README.md`. Passo só de texto: `/simplify` e `/code-review` pulados.
- **Estrutura de pastas (2026-11-23):** virou a seção "Estrutura de pastas" de `reference/camadas.md`, e não uma página própria. A tabela da seção repetia o mapa de `camadas.md` (responsabilidade de cada pasta) e o que o `npm run arch` já barra ("pode importar Nest/TypeORM?"), e uma regra fica como check ou como texto, nunca nos dois (passo 11). Sobrou a árvore, conferida contra `src/`: ganhou `application/events/`, `infra/database/in-memory/`, `infra/cache/`, `infra/events/`, `infra/jobs/`, os `*.example.ts` do `contracts/events/` e as pastas do `shared/infra` que faltavam, e mostra que o notifications não tem `domain/`. No guia, a seção virou ponteiro. Passo só de texto: `/simplify` e `/code-review` pulados.
- **Persistência com TypeORM (2026-11-23):** o porquê foi para `explanation/persistencia.md` (dois modelos e um mapper, `restore` no mapper, `currentManager` em vez de `@InjectRepository`, trocar de ORM, e as alternativas: classe única com decorators, Active Record e o custo do mapper). As regras foram para a seção "TypeORM" de `reference/convencoes.md`, e não para uma página própria, porque são convenções de código como as de import. Ganharam três regras que estavam só no código e no passo 14 do roteiro: id gerado pelo domínio, `createdAt` e `updatedAt` só na ORM entity e a chave composta do filho. Os trechos foram conferidos contra o orders: o repositório real faz a concorrência otimista no `save`, que fica para a página de consistência. O `how-to/gerar-migration.md` foi para a linha de "Módulos independentes", onde o guia trata das migrations. Links do `arquitetura.md` e do `passo-a-passo.md` apontam para as páginas novas. Passo só de texto: `/simplify` e `/code-review` pulados.
- **Módulos independentes e Dependências e contratos (2026-11-23):** as duas seções viraram quatro destinos:
  - `explanation/comunicacao-entre-modulos.md`: schema e migrations por módulo, as três proibições (FK, join, transação) com o motivo comum, a direção única com a volta por evento, a facade que devolve resultado, e por que versionar contratos num deploy só (evento na outbox ou na fila consumido depois do deploy). Alternativas: FK e joins, `forwardRef`, conexão por módulo;
  - `how-to/gerar-uma-migration.md`, a primeira página do quadrante how-to (o nome ganhou o "uma" do título);
  - `reference/camadas.md`: seção "Entre módulos" e as regras de versão na linha do evento de integração;
  - `reference/convencoes.md`: seção "Versionamento da API HTTP". O guia mostrava `version: '1'` em cada controller, e o código usa o `defaultVersion: '1'` do `configureApp`. A seção descreve o código.

  O how-to foi seguido num Postgres descartável (projeto do compose `ddd-howto-mig`, removido com `down -v`): `mig:orders:run`, uma coluna de teste na `OrderOrmEntity`, `mig:orders:gen`, `run`, `migration:revert`, e o generate sem mudança respondendo "No changes". Três achados entraram no how-to: renomear a migration **depois** de rodá-la faz o `run` aplicá-la de novo e falhar (o TypeORM reconhece pelo nome da classe); os testes de integração não leem a pasta de migrations, e cada uma precisa entrar na lista de `test/helpers/<módulo>-database.ts`; e não há script de revert, então o comando vai por extenso. O `comandos.md` passou a dizer que as migrations rodam no pipeline de deploy e a apontar para o how-to. Duas rotas novas no `AGENTS.md`, índice e mapa atualizados, e os links do guia, do `arquitetura.md` e do `passo-a-passo.md` apontam para as páginas novas. Passo só de texto: `/simplify` e `/code-review` pulados.
- **Shared kernel (2026-11-23):** a tabela do que vai para o `shared` já estava em `reference/camadas.md` desde o passo 11, e as regras "não importa `modules/`" e "segue as mesmas camadas" são do `npm run arch` e de `camadas.md`. Sobrou o porquê, em `explanation/shared-kernel.md`: pequeno e estável porque todo módulo depende dele, cada módulo com a sua visão de um conceito, tipos que só parecem iguais (os dois `Email` do glossário), e na dúvida duplicar. Conferido contra o código, o guia errava em dois pontos: o `Product` do catalog não tem descrição nem fotos (tem nome, preço e moeda), e o `Money` é usado só pelo orders, o que contraria a regra "value object usado por um módulo só fica nele". A página registra o `Money` como exceção, com o motivo do passo 2 do roteiro (a regra dele não depende de módulo). Passo só de texto: `/simplify` e `/code-review` pulados.
- **Autenticação e ownership (2026-11-23):** o `reference/autenticacao.md` (fase 1) já tinha rotas, prazos, respostas e o comportamento do refresh token, e a ADR 0002 o porquê do ator por requisição. Sobrou para `explanation/autenticacao.md`: autenticação na infra e ownership no caso de uso, o `ActorResolver` no `shared` ligado pelo `AppModule`, protegido por padrão, o prazo do access token no `TokenIssuer` (e por isso o guard recusa token sem `exp`), o porquê do refresh token opaco, rotativo e com prazo absoluto, a corrida da renovação e o preço de não ter janela de tolerância. Alternativas: 403 ou 404 para quem não é o dono (o orders usa 403), os pacotes `@nestjs/authentication` e `@nestjs/authorization`, e a janela de tolerância. As "Dicas" viraram texto da página (roles por rota no guard, regra por recurso no caso de uso) e a seção "O que fica para quando surgir" (dados do dono, multi-tenant). O filtro pelo ator na listagem foi para a linha "Query" de `camadas.md`. Os trechos foram conferidos contra o código: o ownership do orders está em `application/order-access.ts` (`loadOwnedOrder`), e não repetido em cada caso de uso. Passo só de texto: `/simplify` e `/code-review` pulados.
- **Agregados e comunicação entre módulos (2026-11-23):** foi para `explanation/agregados.md`. O título perdeu o "comunicação entre módulos", que já tem página própria. A página cobre o critério do que fica no agregado, as regras do Vernon, a raiz que controla a lista de itens, o port `StockGateway` com o adapter, e a reserva síncrona. Alternativas: `OrderItem` com repositório próprio, estoque dentro do `Order`, caso de uso chamando a facade sem port, e eventos desde o início. Conferido contra o código, o guia errava em três pontos:
  - **Reserva órfã:** o guia, e o limite do passo 23 do `passo-a-passo.md`, diziam que um `save` que falha depois da reserva deixa estoque reservado. O `PlaceOrderUseCase` reserva dentro do próprio `tx.run`, o `ReserveStockUseCase` reaproveita a transação ativa (`TypeOrmTransactionManager`, coberto pelo `transaction.int-spec.ts`), e os dois módulos usam a mesma conexão. A reserva é desfeita junto com o pedido. A página registra o preço: é a única transação que grava em dois módulos, trava o saldo até o pedido confirmar, e a garantia some com uma conexão por módulo. O `comunicacao-entre-modulos.md` e a linha "Mudança que precisa refletir em outro módulo" de `camadas.md` passaram a citar a exceção;
  - **Troca por eventos:** o guia dizia que, pelo port, a troca não afetaria domain nem casos de uso. Um fluxo por eventos exige um estado de espera no `Order` e um handler que fecha o pedido. O port isola só a chamada: levar o inventory para um serviço à parte muda só o adapter;
  - **"Limite de itens":** o guia o dava como exemplo de regra do agregado, e o `Order` não tem limite. O exemplo virou a regra de não editar depois de fechar.

  O link do passo 23 do `passo-a-passo.md` aponta para a página nova. Rota nova no `AGENTS.md`, índice e mapa atualizados. Passo só de texto: `/simplify` e `/code-review` pulados.

- **Transações, concorrência e eventos (2026-11-23):** a seção virou dois destinos:
  - `explanation/consistencia-e-eventos.md`: a transação pelo `AsyncLocalStorage` e o reaproveitamento da transação aberta, a concorrência otimista no `save` (guardada para esta página desde a seção de persistência), a trava pessimista do pagamento, o update condicional do estoque, a outbox com o relay, a fila por consumidor, o `IdempotentConsumer`, a `Idempotency-Key` e o CQRS leve. O CQRS leve ficou aqui, e não na página de paginação, porque o porquê dele é o mesmo da consistência: a leitura não muda estado e dispensa invariantes, versão e eventos. Alternativas: `EntityManager` por parâmetro, `@nestjs-cls/transactional` (nomes dos pacotes conferidos no Context7), só o `@VersionColumn`, trava pessimista em tudo, publicar depois do commit, enfileirar no caso de uso, barramento em memória, entrega exatamente uma vez e CQRS completo;
  - `how-to/publicar-um-evento-de-integracao.md`, com o "um" no nome, como o `gerar-uma-migration.md`. Cobre os dois lados: publicar e consumir em outro módulo, porque um evento sem consumidor não tem efeito.

  Conferido contra o código, o guia errava ou omitia em quatro pontos:
  - **Pagamento:** o guia tratava só da trava otimista. O `PayOrderUseCase` também trava a linha do pedido (`findByIdForUpdate`), porque a cobrança no fornecedor acontece antes do `save` e não se desfaz;
  - **`Idempotency-Key`:** o guia mandava guardar a impressão digital do corpo e a resposta. O código guarda a chave por ator, com a impressão digital `pay:<orderId>` e um prazo, e não guarda a resposta, porque o pagamento sempre responde 204 sem corpo. O mesmo `pay:<orderId>` vai ao fornecedor como chave da cobrança;
  - **Evento morto:** o guia não dizia o que acontece com os eventos seguintes do mesmo agregado. A busca do relay ignora as linhas com `deadAt`, então eles saem sem o evento morto;
  - **Efeito fora do banco:** o guia apresentava o `IdempotentConsumer` como garantia de efeito único. Ela vale para o que o efeito grava no Postgres, e o e-mail do notifications pode se repetir.

  O how-to foi seguido à mão num worktree descartável: um módulo gerado pelo `plop module teste` passou a publicar `teste.teste-created`, com um consumidor no notifications. Typecheck, `arch` e os testes novos passaram. Num Postgres e num Redis do projeto do compose `ddd-howto-evt` (removido com `down -v`), o `POST /v1/teste` gravou a linha na outbox, publicada em menos de um segundo, e os logs `delivering event`, `processing event` e o efeito do handler saíram. Um achado entrou no how-to: o spec que o gerador cria para o caso de uso precisa dos fakes novos (`FakeOutbox`, `FixedClock`, `FakeTransactionManager`). Fora do escopo: o `typeorm-<módulo>.repository.ts` gerado pelo `plop module` falha no `npm run lint` (`no-misused-spread` no `save`), já antes de qualquer mudança. O link do passo 20 do `passo-a-passo.md` aponta para a página nova. A rota "evento novo" do `AGENTS.md` saiu da linha do guia de pesquisa e virou duas rotas novas. Índice e mapa atualizados. Passo só de texto: `/simplify` e `/code-review` pulados.

- **Paginação (2026-11-23):** virou `how-to/paginar-uma-listagem.md`, com o "um" no nome como os outros how-tos. A seção já era um passo a passo, e a referência (parâmetros `page` e `limit`, limites e formato da resposta) já estava nas docs do [orders](../reference/modules/orders.md) e do [catalog](../reference/modules/catalog.md). O porquê de a leitura ficar numa query, e não no repositório, já está em `explanation/consistencia-e-eventos.md`. O offset contra o cursor ficou no how-to, como uma variante para listas grandes, com uma frase de motivo: não justifica uma página de explicação. Conferido contra o código:
  - **O catalog** pagina com `findAndCount`, `skip` e `take`, ordenado por nome e id, direto no service, e não aparecia no guia. O how-to mostra os dois casos: uma linha por item (catalog) e totais calculados dos filhos (orders);
  - **O `offset` e o `limit`:** o guia dizia que o `skip` e o `take` do TypeORM servem para entidades com relações. A documentação do TypeORM 1.1.1 (Context7) recomenda o `skip` e o `take` com joins, porque um item ocupa várias linhas. Com `GROUP BY` e `getRawMany`, cada linha é um item, e o `LIMIT` do SQL conta itens. O how-to diz isso;
  - **O exemplo de cursor** usava `.take(limit)` numa consulta que o resto do texto lia com `getRawMany`. Trocado por `.limit(limit)`, e registrado que nenhuma listagem do projeto usa cursor.

  O `npm run test:int -- typeorm-order.queries` citado no "Como verificar" passou (4 testes). O 400 do `limit` acima de 100 já é coberto pelo `orders.e2e-spec.ts` (`limit=500`). A listagem não foi conferida com a app no ar. O link do passo 17 do `passo-a-passo.md` aponta para o how-to. Rota nova no `AGENTS.md`, índice e mapa atualizados. Passo só de texto: `/simplify` e `/code-review` pulados.

- **Modelagem do domínio (2026-11-23):** virou `explanation/modelagem-do-dominio.md`. A tabela "Onde validar" não foi para uma página nova: as três linhas já estavam em `reference/camadas.md` (invariante no domínio, validação que depende de dados no caso de uso, formato no DTO HTTP), e a explicação liga para lá. A explicação acrescenta o porquê de a mesma regra aparecer em dois lugares, com dois exemplos do código: a quantidade do item, conferida no `CreateOrderRequest` e no `OrderItem`, e o e-mail único, conferido no `RegisterUserUseCase` e garantido pelo `UNIQUE`, que o repositório traduz para o mesmo erro. O soft delete foi conferido no Context7 (TypeORM: o `deletedAt IS NULL` entra nas consultas do repositório e do query builder, e o `withDeleted` o tira), assim como o `nestjs-cls` (o ator num contexto por requisição). O projeto usa o `uuid` 14.0.3, a latest (atualizado no passo 1 do `evolucao.md`). Como o Context7 só tem a documentação do `uuid` até a v13, o `v7` da 14 foi conferido no pacote instalado: o `import { v7 } from 'uuid'` gera um id de versão 7. Conferido contra o código:
  - **O que não existe:** o `Money.allocate`, os domain services (`domain/services/`, `DiscountPolicy`), o soft delete e o `createdBy`. A página os trata como caminho para quando a necessidade aparecer, e o exemplo do `DiscountPolicy` diz que não existe no projeto;
  - **Os filters:** só o orders e o identity têm filter de erros, ligado por `@UseFilters` no controller, e um `code` fora da tabela responde 422. O guia não dizia o padrão;
  - **O `updatedAt`:** a expiração de pedidos parados depende dele, mas a coluna não vai para o `Order`. O caso de uso calcula o limite pelo `Clock` e o repositório filtra (`findStaleIds`). A página usa o caso como exemplo de "data de auditoria fica na infra";
  - **O `createdBy`:** o guia citava as duas formas de preencher e falava do "único `AsyncLocalStorage` hoje". A página compara as duas sem marcar tempo e acrescenta que um job não tem ator.

  O link do passo 2 do `passo-a-passo.md` aponta para a página nova, e o passo deixou de mandar copiar o `Money` do guia. Rota nova no `AGENTS.md`, índice e mapa atualizados. Passo só de texto: `/simplify` e `/code-review` pulados.

- **Infra: configuração, jobs, cache e serviços externos (2026-11-23):** a seção virou seis páginas, e não "how-tos por tarefa e `variaveis-de-ambiente.md`" apenas, porque três subseções eram quase só porquê:
  - `how-to/adicionar-uma-variavel-de-ambiente.md`: a declaração na `EnvironmentVariables`, o interruptor como texto (`'true'`/`'false'`, porque o `enableImplicitConversion` transformaria `'false'` em `true`), o `useFactory` com `ConfigService<EnvironmentVariables, true>`, o `RENAMED`, o `test/setup-env.ts`, o spec e a tabela da referência. As regras de carga já estavam em `variaveis-de-ambiente.md` (fase 1), e a regra "o caso de uso recebe valores prontos" em `camadas.md`;
  - `how-to/agendar-um-job.md`: o processor sobre o `ScheduledJobProcessor`, a fila por job, o nome do agendador e o teste com duas instâncias, a partir do `expire-pending-orders.processor.int-spec.ts`;
  - `how-to/cachear-uma-leitura.md`: o decorator da query, a chave com geração, o TTL da geração em dobro, o `useExisting` no módulo, o handler de invalidação e os casos de teste do `cached-order.queries.spec.ts`;
  - `how-to/criar-um-seed.md`: dados obrigatórios vão em migration, e o seed usa ids fixos, `orIgnore()`, o `runSeed` e o script com `@app/source`. O `comandos.md` passou a apontar para ele;
  - `explanation/redis.md`: por que um Redis com várias instâncias, uma instância só para filas e cache em desenvolvimento (`noeviction` e AOF no `docker-compose.yml`), os dois clientes e as três conexões, uma tabela do que acontece com cada uso com o Redis fora do ar, o cache por geração e os jobs pelo agendador do BullMQ. O título não cita cache e jobs porque a página trata de tudo que depende do Redis;
  - `explanation/servicos-externos.md`: port e adapter, a tradução para `PaymentUnavailableError` (503), a resiliência no decorator `ResilientPaymentGateway`, o timeout que não cancela a chamada, o retry só com chave de idempotência e o circuit breaker como caminho futuro.

  Conferido no Context7: BullMQ (`/taskforcesh/bullmq`, v6: repeatable jobs removidos, `upsertJobScheduler` com `attempts` no template, `setGlobalConcurrency`, `maxRetriesPerRequest: null` e o backend em Postgres) e Keyv (`/jaredwray/keyv`: `throwOnErrors` com padrão `false`, `throwOnConnectError` com padrão `true` e o listener de `error`). Conferido contra o código, o guia errava ou omitia em cinco pontos:
  - **Cache:** o exemplo do guia lia e gravava sem `try/catch`. O código trata cada chamada, não usa o cache quando a leitura da geração falha, converte a data de volta para `Date` e dá à geração o dobro do TTL das páginas;
  - **Redis fora do ar:** o guia tratava só do cache. Cada uso falha de um jeito (rate limit com 503, agendador barrando a subida, relay com backoff até o `deadAt`), e a página registra o porquê de cada um;
  - **Conexões:** o guia falava em dois clientes. São três conexões: `producer` e `worker` do `ioredis` e a do cache, com o cliente `redis`;
  - **Jobs:** o guia não dizia que o job falho não se repete até o próximo disparo, nem que um agendador renomeado fica no Redis;
  - **E-mail:** o guia mandava retry com backoff em operações idempotentes, sem dizer onde. O e-mail não tem retry no adapter, porque a fila do consumidor já repete.

  Fora do escopo: os comentários do `LoggingEmailSender` e do port `EmailSender` dizem que "a outbox" repete o envio, mas quem repete é a fila do consumidor (10 tentativas). Os links dos passos de configuração e do Redis do `passo-a-passo.md` apontam para as páginas novas. Seis rotas novas ou ampliadas no `AGENTS.md`, índice e mapa atualizados. Passo só de texto: `/simplify` e `/code-review` pulados.

- **Qualidade (2026-11-23):** a seção virou duas páginas, e não `reference/qualidade.md`, porque duas das quatro subseções já tinham casa:
  - `reference/testes.md`: o runner, a decorator metadata e o `setup-env` (que saíram de `comandos.md`, agora com um link para a página), o tipo de teste de cada camada, os helpers que pedem atenção e as convenções que nenhuma config confere;
  - `explanation/observabilidade.md`: o trace no lugar do correlation id, o tracing antes da app, o `traceparent` que atravessa a outbox e as filas, o `trace_id` nos logs, o port `Logger` e o que fica sem span. O item "O trace atravessa a fila" de `consistencia-e-eventos.md` virou link para ela;
  - **Lint e formatação:** já estava no ADR 0004 e em `comandos.md`. Só a versão exata do Prettier não tinha registro e foi para a seção "Versão exata" de `versoes-e-excecoes.md`, com a recomendação da documentação do Prettier (Context7);
  - **Regras de arquitetura no CI:** já estavam no `.dependency-cruiser.js` desde o passo 11. O porquê do `tsPreCompilationDeps: 'specify'` virou comentário no arquivo, e o `severity: 'error'` passou a ser o padrão de todas as regras por um `map`, no lugar de 11 cópias (uma regra nova não cai mais em `warn` por esquecimento, e uma regra ainda pode declarar outra `severity`). Uma violação de propósito em `domain/` fez o `arch` sair com 1.

  Conferido contra o código, o guia errava ou omitia em quatro pontos:
  - **Contrato da facade:** o guia falava em exemplos versionados de chamadas da facade. Só os eventos têm exemplo e teste de contrato, e o `typecheck` confere a facade dos dois lados;
  - **Unitários além do domain e dos casos de uso:** adapters, gateways, guards, handlers e o decorator de cache têm spec com fakes, e o Redis dos testes de integração sobe pelo `test/helpers/redis.ts`;
  - **Hook ESM:** o guia dizia que o `module.register` é o caminho da documentação do OpenTelemetry. A documentação (Context7, 2026-11-23) mostra a flag `--experimental-loader` na linha de comando, e o `module.register` é o equivalente em código;
  - **Spans do pino:** a instrumentação do pino não cria spans, só põe o `trace_id` e o `span_id` no log. A versão da instrumentação do Nest (0.72.1, `>=4.0.0 <12`) e o `logKeys` do pino foram conferidos em `node_modules`.

  Ficam para a seção Operação os fatos de log que são referência: o `x-request-id`, os campos do log de acesso e o `redact`. O link do passo 7 do `passo-a-passo.md` aponta para o `.dependency-cruiser.js`. Duas rotas novas no `AGENTS.md`, índice e mapa atualizados. `/simplify` (quatro revisores): saíram as repetições de `comandos.md`, do ADR 0004 e do `eslint.config.mjs` na página de testes, o catálogo arquivo por arquivo de `test/helpers/`, as versões e o histórico na explicação, o número da versão do Prettier e o `severity` repetido. `/code-review`: o `map` passou a aceitar uma `severity` declarada na regra, o passo 7 do `passo-a-passo.md` manda copiar a lista junto com o `map`, e a coluna "Arquivo" dos testes de Postgres deixou de prender todos em `infra/database/typeorm/` (o catalog e a outbox têm os seus em outro lugar). Ficou de fora um spec que confira se cada migration está na lista do helper de integração e um teste dos spans do `ioredis` e do `express`: são checks novos, maiores que este passo, e ficam registrados aqui como candidatos.

- **Operação (2026-11-23):** a seção virou dois destinos:
  - `reference/operacao.md`: a configuração HTTP do `configureApp`, o Swagger (endereços, tags e as opções do plugin), as duas rotas de health, o rate limit (limites, bloqueio, headers, contadores no Redis e o 503 com ele fora do ar), os logs de acesso com o `x-request-id` e o `redact` (deixados para cá pela seção Qualidade), e a ordem de desligamento, fase a fase, com quem age em cada uma. As variáveis e os endereços não se repetem: a página aponta para `variaveis-de-ambiente.md` e `comandos.md`, e o `comandos.md` aponta de volta;
  - "Extrair um módulo para um serviço", seção nova de `explanation/comunicacao-entre-modulos.md`, e não da página de referência, porque explica um porquê. O link do `arquitetura.md` aponta para ela.

  Conferido no Context7: `@nestjs/swagger` (padrão do `dtoFileNameSuffix`, e o plugin fora do ts-jest), `@nestjs/terminus` (`HealthIndicatorService`, e o `gracefulShutdownTimeoutMs` com padrão `0`) e `@nestjs/throttler` (headers da resposta e a interface `ThrottlerStorage`). Conferido nos fontes de `node_modules`: a ordem de desligamento do Nest (hooks, depois o servidor HTTP, depois `onApplicationShutdown`), o `blockDuration` com padrão igual ao `ttl`, o `/docs-json` e o `/docs-yaml`, e o `dist/` com os metadados do plugin, que roda no build ESM. O guia errava ou omitia em cinco pontos:
  - **Eventos:** o guia falava em "barramento em memória". A outbox e as filas já passam pelo Redis. O que fica preso ao processo é a lista de consumidores, montada pela varredura dos `@IntegrationEventHandler`: um consumidor extraído some dela, e a fila dele para de receber eventos sem erro;
  - **JWT:** o guia dizia que o serviço extraído valida o JWT sozinho. O token só leva o `sub`, e o ator vem do `ActorResolver` do identity (ADR 0002), então o serviço precisa de outro resolver;
  - **Dados:** o guia não citava a transação compartilhada da reserva de estoque, que some se o inventory sair;
  - **Desligamento:** o guia dizia que o desligamento termina requisições e jobs. Os workers param antes do servidor HTTP, que continua aceitando requisições até a fase 3, e o `/health/ready` não passa a 503 nesse meio tempo;
  - **Rate limit:** o guia não dizia o que acontece com o Redis fora do ar (503) nem o bloqueio depois do limite.

  Fora do escopo: no desligamento, o `/health/ready` continua 200 até o servidor fechar. Um `gracefulShutdownTimeoutMs` no `TerminusModule`, um pouco maior que o intervalo da sonda, tiraria a instância do tráfego antes. Fica como candidato para quando houver um orquestrador. A página não foi conferida com a app no ar: nenhuma instância respondia na porta 3000, e os containers do compose estavam parados. `/simplify` e `/code-review`: pulados, o passo só mexe em Markdown. Rota nova no `AGENTS.md`, índice e mapa atualizados.

- **Pragmatismo e checklist, e Referências (2026-11-23):** as últimas seções. Com elas, o guia ficou só com ponteiros, e o passo 12 fecha. Nenhuma virou `explanation/pragmatismo.md` nem `how-to/revisar-um-modulo.md`:
  - **"Nem todo módulo precisa de DDD"** já estava em `explanation/arquitetura.md` ("Nem todo módulo precisa das camadas") e na seção "Estrutura" do catalog. O link do catalog e o do passo 22 do `passo-a-passo.md`, que apontavam para o guia, passaram a apontar para lá;
  - **"Gerador de módulos" e "Checklist de um módulo novo"** viraram `how-to/criar-um-modulo.md`, que adianta um how-to do passo 13. O resumo do `plopfile.mjs` saiu: o arquivo e a linha do `plop module` em `comandos.md` são a referência. Do checklist ficou só o que nenhum check confere e que vale para um módulo novo. Saíram os itens que o `arch` e o `lint` barram (imports de camada, `abstract class`, fronteiras, ciclos), os que valem para a app inteira e já existem uma vez (`ValidationPipe`, guard global, `helmet`, health, Redis com `noeviction`, variáveis validadas, outbox com `SKIP LOCKED`) e as versões, que estão no `package.json`;
  - **Referências** virou `reference/leituras.md`, e não uma seção do `docs/README.md`: são 39 links que um agente roteado para o índice não precisa ler. Saíram o "TypeORM 1.0 is here" e o "BullMQ: Repeatable (legado)", que só registravam o contexto da migração de versão.

  O how-to foi seguido num worktree descartável, com um Postgres e um Redis do projeto do compose `ddd-howto-mod` (removido com `down -v`): `plop module shipment`, as migrations dos seis módulos, o seed do identity e o `start:dev`. `POST /v1/shipment` respondeu 401 sem token e `{ id }` com o token do admin. O `GET` devolveu `{ id, name }`, um uuid inexistente deu 404 com `SHIPMENT_NOT_FOUND`, e um corpo vazio deu 400. Dois achados mudaram o gerador:
  - **Lint:** o repositório gerado falhava no `npm run lint` (`no-misused-spread` no `save`, registrado na seção Transações como fora do escopo). O template passou a atribuir a versão à linha, como o `typeorm-order.repository.ts`;
  - **Testes de integração:** o gerador não criava o helper nem o int-spec, e o how-to mandava escrevê-los à mão. O `/simplify` apontou que o gerador já sabe as classes das migrations e o nome da tabela de migrations, e que o how-to escrito à mão já errava o nome para um módulo com hífen (`<nome>_migrations` no lugar do snake_case do DataSource). O gerador passou a criar `test/helpers/<nome>-database.ts` e `typeorm-<nome>.repository.int-spec.ts` (salvar e buscar, id desconhecido e `ConcurrencyError` numa versão velha). Ele recusa o nome se o helper já existir.

  Conferido de novo com `plop module price-list`, que separa kebab de snake case: `typecheck`, `lint`, `arch`, `format:check`, os unitários (2) e os de integração (3) passaram. O `docs:links` acusou 403 no `npmjs.com/package/pg-types`, que bloqueia o lychee. É o mesmo link do guia, e a página abre no navegador. Rota "Criar um módulo novo" no `AGENTS.md` no lugar da rota para o guia, índice do `docs/README.md` e mapa do `README.md` atualizados.

  `/simplify` (quatro revisores): saíram a lista do que o gerador cria (fica em `comandos.md` e no terminal), os passos à mão do helper e do int-spec, a regra do 422, a lista do que o `ci` roda, o item "job só chama caso de uso" (o `arch` barra persistência em `infra/jobs`), os itens repetidos entre os passos e o checklist e os que têm how-to próprio (cache, job, fornecedor). O pré-requisito passou a subir também o Redis, que o `start:dev` exige. Ficou de fora um script que gere um módulo num worktree e rode `tsc`, `lint` e os testes nele, para os templates não voltarem a falhar sem ninguém ver: é um check novo, de 30 a 60 s, e fica como candidato para quando os templates mudarem de novo.

  `/code-review`: o gerador não punha o módulo nos loops de migration do setup do zero (`README.md` e `comandos.md`), e quem clonasse o repositório ficava sem as tabelas dele. O `plopfile.mjs` passou a acrescentá-lo aos dois loops e a conferir se acrescentou, como faz com o `app.module.ts`. Um loop fora do padrão faz o gerador parar com "não entrou no loop de migrations", conferido de propósito. A linha `mig:<módulo>:run` de `comandos.md` deixou de listar os módulos à mão. Ajustes de texto: o `code` do 404 em constant case (`PRICE_LIST_NOT_FOUND`), um parágrafo que manda consumidor de evento, cache, job e fornecedor para a página de cada um, a rota de camadas do `AGENTS.md` cobrindo "criar entidade, caso de uso ou repositório" (a rota antiga para o guia fazia isso), e o trecho do `save` no passo 21 do `passo-a-passo.md` sem o spread. Ficaram de fora os dois links tirados de propósito de `leituras.md` e o `evolucao.md` e o `passo-a-passo.md`, que ainda chamam o guia de "guia de referência": o passo 15 os troca quando o guia sair.

### Passo 13: how-tos e skills-ponteiro

**Por quê:** num how-to, o humano lê o passo a passo. Numa skill, a descrição fica sempre visível para o Claude, e o corpo só carrega quando a skill é usada.

**Faça:**

- Escreva os how-tos que a fase 1 deixou só em `reference/comandos.md`: rodar migrations e seeds, criar um módulo, rodar um teste específico, resetar o ambiente, publicar evento de integração.
- Crie skills-ponteiro **só** para os procedimentos que se repetem. Os candidatos são criar módulo, gerar migration e publicar evento de integração.
- Cada skill fica em `.claude/skills/<nome>/SKILL.md`. A `description` começa pelo gatilho ("Use ao …"), e o corpo diz "siga `docs/how-to/x.md`; verifique com `npm run …`".

**Pronto quando:** em uma sessão nova, um pedido como "crie um módulo billing" faz o Claude escolher a skill sem que ela seja citada, e o how-to funciona seguido à mão.

**Como ficou:**

- **Criar um módulo (2026-11-23):** `how-to/criar-um-modulo.md` saiu do passo 12, com a seção "Pragmatismo e checklist" do guia, e foi seguido à mão (ver o passo 12).
- **How-tos (2026-11-23):** "publicar evento de integração" já existia desde o passo 12. Faltavam três, gerados pelo `plop doc`:
  - `how-to/rodar-as-migrations-e-os-seeds.md`: os passos apontam para os loops do Setup do zero em `comandos.md`, sem copiá-los. O `plop module` mantém o loop de migrations no `README.md` e no `comandos.md`, e uma terceira cópia ficaria para trás no primeiro módulo novo. A página acrescenta o `migration:show` para conferir o que falta e uma tabela de sintomas: o `NODE_ENV` do shell vence o do `.env`, o `Missing script: "mig:ordersun"` do zsh sem aspas e a migration que falhou no meio;
  - `how-to/rodar-um-teste-especifico.md`: o script pelo sufixo do arquivo, o filtro por trecho de caminho (sem diferenciar maiúsculas, vários trechos somam), por nome com `-t` (regex sobre o nome com os `describe`) e por linha, que exige o caminho completo. Conferido no Context7 (Vitest, filtro de arquivos e `-t`) e no Vitest 5.1.1: `money.vo -t "soma valores"` roda 1 e pula 5, `money.vo:11` falha com "Couldn't find file" e `src/shared/domain/money.vo.spec.ts:11` roda 1, um padrão sem arquivo sai com código 1 e mostra o `include`;
  - `how-to/resetar-o-ambiente-local.md`: `down -v`, `up -d --wait`, migrations e seeds pelo how-to acima, e a conferência pelo `/health/ready` e pelo login.

  Seguidos à mão num projeto do compose descartável (`ddd-howto-ops`, removido com `down -v`), com o `.env` do repositório: `up -d --wait` voltou com os dois `healthy` em 23 s; o `migration:show` listou as quatro do orders com `[ ]` e, depois do loop, com `[X]`; os dois loops e um segundo `mig:orders:run` ("No migrations are pending") saíram com código 0; `NODE_ENV=production` no shell fez o seed recusar. O reset apagou os dois volumes do projeto, e depois de subir tudo de novo o `/health/ready` deu 200 com `database` e `redis` `up` e o login do admin devolveu `accessToken`. `test:e2e -- auth` (21 testes) e `test:int -- idempotent-consumer` (5) passaram, e `test:int -- money` saiu com código 1, como a página diz. O `comandos.md` aponta para as três páginas nas seções de testes, migrations e baixar o ambiente, e a rota "Rodar, testar, migrar…" do `AGENTS.md` chega a elas por lá, sem linha nova. Índice e mapa do `README.md` atualizados.
- **Skills-ponteiro (2026-11-23, adiadas):** criadas, testadas e depois removidas do projeto por decisão do dono do repositório, que ainda não quer usar skills. O registro abaixo fica para quando elas voltarem. Eram `.claude/skills/criar-modulo`, `gerar-migration` e `publicar-evento-de-integracao`. Diferente do "Faça", o corpo não repete os comandos de verificação: o critério de pronto é "cada item de 'Como verificar' do how-to passa", para a verificação ficar num lugar só. O corpo também manda corrigir o how-to se um passo não funcionar como está escrito. O `docs:check` já confere os caminhos citados em `.claude/`: um caminho quebrado de propósito numa skill falhou com `agent-pointer` e foi desfeito.

  Teste de roteamento com `claude -p` em modo plan, numa sessão nova, sem citar as skills. As três aparecem na lista de skills da sessão. "crie um módulo billing" leu a `criar-modulo` e o how-to, e a resposta diz que o plano segue os dois. "acrescente uma coluna note (texto, opcional) na tabela de pedidos" leu a `gerar-migration` e o how-to. "quando um pedido for cancelado, o notifications deve mandar um e-mail ao cliente" chegou ao how-to pela rota do `AGENTS.md`, mas não à skill: a descrição só dizia "evento de integração", e o pedido não diz "evento". A descrição passou a começar pelo gatilho "um módulo deve reagir a um fato de outro módulo", e na repetição a primeira ação da sessão foi ler a skill. Nas três, a skill foi lida pelo arquivo, e não pela ferramenta `Skill`. Os planos que as sessões gravaram em `~/.claude/plans` foram apagados.

  Passo só de texto (Markdown e skills): `/simplify` e `/code-review` pulados.

### Passo 14: tutoriais

**Por quê:** o tutorial é onde o leitor aprende fazendo. Um tutorial que quebra afasta quem está começando.

**Faça:**

- **`tutorials/01-do-clone-ao-primeiro-pedido.md`:** registrar, fazer login, criar o pedido, fechar e pagar. Os passos seguem o mesmo fluxo de um teste e2e existente ou novo, que serve de verificação do tutorial. Cite o arquivo do teste no tutorial.
- **`tutorials/02-construindo-do-zero.md`:** mova o `docs/plan/passo-a-passo.md`, acrescente `type: tutorial` e corrija os links (o `evolucao.md` o chama de "roteiro original").

**Pronto quando:** o tutorial 01 seguido à mão num banco vazio funciona, o e2e correspondente passa, e nenhum link para o `passo-a-passo.md` antigo sobra.

**Como ficou (2026-11-23):**

- **Tutorial 01:** gerado pelo `plop doc tutorial`. Onze passos, do `npm install` ao e-mail simulado no log, só com `curl` e um helper `json` em Node (sem `jq`, que o leitor pode não ter). Usa o mouse do seed do catalog, paga com `Idempotency-Key` e repete o pagamento para mostrar que não cobra de novo. O "O que você aprendeu" liga cada conceito à sua explicação. Um pré-requisito pede ambiente limpo, porque os e2e gravam no mesmo banco e enchem a listagem de produtos.
- **Achado ao seguir à mão:** depois de fechar e de pagar, a listagem ainda mostrava `DRAFT`. Ela vem do cache que o evento invalida, cerca de um segundo depois do commit (consistência eventual, já descrita em `explanation/redis.md`). O tutorial passou a esperar com `sleep 2` antes de listar e a ensinar isso. Nada mudou no código.
- **E2E espelho:** `test/primeiro-pedido.e2e-spec.ts`, com os passos 5 a 11 numerados como no tutorial. Liga os workers (`enable-outbox-worker`), troca o `EmailSender` por um que guarda os e-mails, espera a listagem mudar com `waitFor` e confere um evento `orders.order-paid` só e o e-mail do pedido. O produto é do teste (`seedProduct`, com nome próprio), para o estoque do seed não acabar entre execuções. O `expiresIn` vem da configuração, como no `auth.e2e-spec`.
- **Loop de migrations:** o tutorial repete o loop do setup, como um tutorial deve, e entrou no `SETUP_DOCS` do `plopfile.mjs`, que acrescenta cada módulo novo ao loop e falha se não conseguir. A regex foi conferida nos três arquivos. O loop de seeds não tem gerador: o passo 4 de `how-to/criar-um-seed.md` passou a citar o tutorial.
- **Tutorial 02:** o `passo-a-passo.md` virou `tutorials/02-construindo-do-zero.md` com `git mv`, `type: tutorial` e um aviso de que usa as ferramentas da época, com link para o `evolucao.md`. No índice, aparece como roteiro histórico. Os links de quatro páginas de explicação, do `evolucao.md` ("roteiro original") e do `docs/README.md` apontam para o caminho novo. O `/simplify` e o `/code-review` apontaram que um roteiro que não funciona seguido do zero contradiz a definição de tutorial. Ficou como o plano pede, com o aviso. A alternativa é registrá-lo fora dos quadrantes.
- **Verificação:** o tutorial foi seguido duas vezes num banco vazio (projeto do compose `ddd-tutorial-01`, removido com `down -v`). Na segunda, os comandos foram extraídos do próprio arquivo e rodados no zsh: `/health/ready` 200, cadastro, token, três produtos, `DRAFT` com `totalCents` 29800, `PLACED` e `PAID` depois do `sleep 2`, e a linha `email sent (simulated)` uma vez só. Um segundo cadastro com o mesmo e-mail devolveu `EMAIL_ALREADY_IN_USE`, como o passo 5 diz. A suíte e2e inteira passou (8 arquivos, 52 testes), e o `npm run ci` também.
- **`/simplify`:** quatro revisores. Aplicados: o helper `json` no passo 6, onde é usado; o passo 9 mais curto; o tutorial aponta para os Seeds em vez de descrever os dados; e o `comandos.md` cita o `SETUP_DOCS` em vez de listar os arquivos. Ficaram de fora: um helper para a montagem da app com o e-mail falso, que o `outbox.e2e-spec` também faz (só dois usos). Dois candidatos de código: um script `db:setup` que leia os `mig:*:run` e `seed:*` do `package.json`, para substituir os loops copiados e a regex do plop; e um `GET /v1/orders/:id` sem cache, que o `redis.md` já prevê para a confirmação de um pagamento e que dispensaria o `sleep` do tutorial.
- **`/code-review`:** o `expiresIn: 900` fixo quebraria com outro TTL no `.env`, e passou a vir da configuração. O teste passou a listar os produtos, como o tutorial. O "uma vez só" passou a ser conferido pelo evento único na outbox, e a entrega duplicada fica com o `idempotent-consumer.int-spec`. O produto do teste ganhou nome próprio, e o comentário do `test/setup-env.ts` sobre quem liga os workers foi corrigido.

### Passo 15: remover `docs/research/`

**Faça:** quando todas as seções do guia tiverem virado link, apague o arquivo e a pasta. Atualize as referências no `CLAUDE.md`, no `AGENTS.md`, no `evolucao.md` e nos ADRs.

**Pronto quando:** `grep -r "research/" .` (fora de `node_modules` e `dist`) não encontra nada, e o `docs:check` passa.

**Como ficou (2026-11-23):** o guia, já só com ponteiros, saiu com a pasta. Referências trocadas:

- **`docs/README.md`:** saiu a linha do guia em "Fora dos quadrantes".
- **`passo-a-passo.md`:** a introdução aponta para `explanation/arquitetura.md`, e "o código completo está no guia de referência" passou a "está em `src/`, na forma final". As oito citações "copiado do guia de referência" ou "ver guia de referência" apontam para o arquivo correspondente em `src/` (`order.entity.ts`, `order.repository.ts`, `create-order.use-case.ts`, `current-user.decorator.ts`, `aggregate-root.ts`, `idempotent-consumer.ts`), para o `package.json` (scripts de migration) e para a estrutura de pastas de `reference/camadas.md` (gerador).
- **`evolucao.md`:** a linha do "Como usar" diz que o guia acompanhava o código e foi dividido e removido por este plano. As menções do passo 17 e dos "No guia" ficam como registro do que foi feito na época.
- **ADR 0006:** a decisão 2 cita o guia pelo nome, sem o caminho. O conteúdo da decisão não mudou.
- **Código:** o comentário do `products.service.ts` citava o "Pragmatismo" do guia e passou a apontar para `docs/explanation/arquitetura.md`.

`CLAUDE.md` e `AGENTS.md` já não citavam o guia desde o passo 12. Os dois links que o passo 12 tirou de `leituras.md` de propósito continuam fora. O grep só encontra este plano, que registra o próprio passo e o histórico da divisão. `npm run ci` passou (191 testes, `docs:check` sem erros, arch sem violações). Passo de texto mais um comentário: `/simplify` e `/code-review` pulados.

---

## Validação da entrega

Marque cada item com a evidência: o comando e o resultado, ou a observação.

### Fase 1

**Automático:**

- [x] `npm run ci` passa, com o `docs:check` incluído. 2026-11-23: exit 0, 191 testes, arch sem violações.
- [x] Teste negativo: quebrar um link interno, uma âncora, um `type:` e incluir um `@docs/` no `AGENTS.md`. Cada caso faz o `docs:check` falhar e é desfeito depois. 2026-11-23: link, âncora e `type:` no passo 2; `@docs/` e ponteiro inexistente no `AGENTS.md` no passo 5 (`agent-import` e `agent-pointer`).
- [x] `npm run plop doc` gera os quatro tipos. Recém-gerados, eles falham só pela regra `scaffold`, e passam no `docs:check` depois de apagados os comentários. 2026-11-23: 21 avisos `scaffold` e nenhum outro (passo 3).

**Conteúdo:**

- [x] Cada seção do `CLAUDE.md` antigo tem destino conferido na tabela do passo 4. Nenhum fato se perdeu. 2026-11-23: ver o "Como ficou" do passo 5.
- [x] O `CLAUDE.md` com o `AGENTS.md` expandido tem menos de 200 linhas, e o `AGENTS.md` sozinho tem até 100. 2026-11-23: 75 e 53.
- [x] Os únicos imports com `@` nos arquivos de agente são `@AGENTS.md` no `CLAUDE.md`. 2026-11-23: o `docs:check` passa, e o `--conditions=@app/source` do `AGENTS.md` está entre crases.
- [x] O `evolucao.md` aponta para `reference/versoes-e-excecoes.md`, e a tabela de exceções existe num lugar só. 2026-11-23 (passo 4).
- [x] Nenhum termo datado em páginas de quadrante: `grep -rniE "\b(hoje|atualmente|recentemente|novo)\b" docs/{tutorials,how-to,reference,explanation}` só encontra usos legítimos. 2026-11-23: só "de novo", "um novo" e "par novo".
- [x] Cada "ADR 000N" citado no código (`grep -rhoE "ADR [0-9]{4}" src | sort -u`) tem o arquivo correspondente em `docs/adr/`. 2026-11-23: 0002 e 0003, os dois existem.

**Uso real:**

- [x] Setup do zero pelo `README.md` num banco vazio (sem `.env`, sem volumes): migrations, seeds, `start:dev`, `/health/live` e `/docs` funcionam seguindo só links. 2026-11-23: ver o "Como ficou" do passo 6.
- [x] Numa sessão nova do Claude Code, `/memory` (ou `/context`) mostra o `CLAUDE.md` e o `AGENTS.md` carregados. 2026-11-23: o `/memory` lista o `./CLAUDE.md` em "Project instructions" e o `AGENTS.md` como `@-imported` logo abaixo.
- [x] Teste de roteamento numa sessão nova, sem dicas. O agente acha a resposta lendo a página certa de `docs/`, sem varrer o repositório com grep, para estas perguntas:
  - "Como rodo só o teste de integração do pay-order?"
  - "Por que o token não leva as roles?"
  - "Qual versão do TypeScript devo usar e por quê?"

  2026-11-23:

  - **pay-order:** respondido pelo `AGENTS.md`, sem abrir `comandos.md`. Na primeira rodada, o comando veio certo, mas os avisos do e2e (docker-compose no ar, `start:dev` aberto) foram aplicados à integração. A verificação do `AGENTS.md` passou a separar os dois: o `test:int` sobe containers próprios e só precisa do Docker. Numa sessão nova, a resposta veio certa;
  - **roles:** leu `docs/reference/autenticacao.md` e seguiu para a ADR 0002 (com um `grep` só em `docs/adr` para achá-la). A resposta trouxe o motivo, o custo e as alternativas;
  - **TypeScript:** foi direto a `docs/reference/versoes-e-excecoes.md`, conferiu o `package.json` e a latest no npm, e respondeu `~6.0` com os motivos e os gatilhos.
- [x] `/doctor prompt-audit` (se disponível na versão instalada) não aponta contradição nem arquivo inexistente. 2026-11-23: "nothing to change", com diff vazio. Leu o `CLAUDE.md` e o `AGENTS.md` importado, e todo caminho, script e comando citado no `AGENTS.md` existe. Não há contradição entre os dois, e cada proibição traz o motivo. Ressalvas do próprio audit: rodou com o Sonnet 5.5 e não auditou o conteúdo dos plugins instalados.
- [x] `/simplify` e `/code-review` rodados sobre scripts, `plopfile.mjs` e `package.json`. 2026-11-23: no passo 2 (`package.json`, configs e `scripts/remark-docs-rules.mjs`) e no passo 3 (`plopfile.mjs`, templates e a regra `scaffold`). Os achados estão no "Como ficou" de cada passo.

### Fase 2

- [x] Os cinco `docs/reference/modules/*.md` existem e passam no `docs:check`. 2026-11-23: `npm run ci` com exit 0.
- [x] Cada facade em `src/modules/*/contracts/` e cada evento em `contracts/events/` aparecem no doc do seu módulo: `ls src/modules/*/contracts` comparado com as seções "Contrato público" e "Eventos publicados". 2026-11-23: `CatalogFacade`, `InventoryFacade`, `UserDirectoryFacade` e os quatro eventos do orders.
- [x] Os termos `User`, `Actor` e `Customer`, e `OrderCreated` e `OrderPlaced`, estão definidos sem ambiguidade. 2026-11-23: ver o passo 8.
- [x] Todo termo das seções "Linguagem ubíqua" está no índice do `glossario.md`. 2026-11-23: 29 termos.
- [x] `npm run plop module teste` gera a doc do módulo, que é desfeita depois. 2026-11-23: com `teste-doc`, ver o passo 7.
- [x] `/context` numa sessão nova: a `.claude/rules/modules.md` não carrega no início e carrega depois de ler um arquivo em `src/modules/`. 2026-11-23: nem o `/context` nem o `/memory` listam as regras de `.claude/rules/`, por isso a conferência foi pela pergunta "Quais instruções de `.claude/rules/` estão no seu contexto agora?", feita depois do Read do `order.entity.ts`. A sessão citou o texto da regra e disse que ele chegou como lembrete do sistema depois dessa leitura. Antes dela, grep e `ls` em `src/modules/` não a carregaram.
- [x] Teste de roteamento numa sessão nova: para "Quais eventos o orders publica e quem consome?", o agente responde a partir de `docs/reference/modules/` e acerta. Feito em 2026-11-23: a primeira leitura foi o `orders.md`, e a resposta trouxe os quatro eventos e os três consumidores certos. Depois o agente rodou grep nos handlers para conferir a tabela, e o código bateu com a doc.
- [x] `/simplify` e `/code-review` rodados sobre o template e o `plopfile.mjs`. 2026-11-23: também sobre a regra `module-doc` e as docs. Ver o passo 7.

### Fase 3 (por passo)

- [x] **Passo 11:** cada convenção de camada está como check ou como texto, nunca nos dois. Uma violação de propósito falha no `arch` ou no `lint`. 2026-11-23: ver o "Como ficou" do passo 11.
- [x] **Passo 12:** cada seção migrada virou link no guia e aparece no índice. Os trechos de código foram conferidos contra o código. Concluído em 2026-11-23: Pragmatismo e checklist, em `explanation/arquitetura.md` e `how-to/criar-um-modulo.md`; Referências, em `reference/leituras.md`; Visão geral e Camadas, em `explanation/arquitetura.md`; Estrutura de pastas, em `reference/camadas.md`; Persistência com TypeORM, em `explanation/persistencia.md` e `reference/convencoes.md`; Módulos independentes e Dependências e contratos, em `explanation/comunicacao-entre-modulos.md`, `how-to/gerar-uma-migration.md`, `reference/camadas.md` e `reference/convencoes.md`; Shared kernel, em `explanation/shared-kernel.md`; Autenticação e ownership, em `explanation/autenticacao.md`; Agregados e comunicação entre módulos, em `explanation/agregados.md`; Transações, concorrência e eventos, em `explanation/consistencia-e-eventos.md` e `how-to/publicar-um-evento-de-integracao.md`; Paginação, em `how-to/paginar-uma-listagem.md`; Modelagem do domínio, em `explanation/modelagem-do-dominio.md`; Infra, em `how-to/adicionar-uma-variavel-de-ambiente.md`, `how-to/agendar-um-job.md`, `how-to/cachear-uma-leitura.md`, `how-to/criar-um-seed.md`, `explanation/redis.md` e `explanation/servicos-externos.md`; Qualidade, em `reference/testes.md` e `explanation/observabilidade.md`; Operação, em `reference/operacao.md` e `explanation/comunicacao-entre-modulos.md`.
- [ ] **Passo 13:** cada skill é escolhida pelo Claude a partir de um pedido natural, sem ser citada. Cada how-to funciona seguido à mão. 2026-11-23: os três how-tos novos foram seguidos num projeto do compose descartável. As skills passaram no teste de roteamento, a de evento depois de ajustar a descrição, mas foram removidas: ficam adiadas. Ver o "Como ficou" do passo 13.
- [x] **Passo 14:** o tutorial 01 funciona num banco vazio, e o e2e espelho passa. 2026-11-23: seguido duas vezes num banco vazio, a segunda com os comandos extraídos do arquivo; `test/primeiro-pedido.e2e-spec.ts` e a suíte e2e inteira passaram. Ver o "Como ficou" do passo 14.
- [x] **Passo 15:** nenhuma referência a `docs/research/` sobra no repositório. 2026-11-23: o grep só encontra este plano, que registra a remoção. Ver o "Como ficou" do passo 15.

### Contínuo (depois da entrega)

- [ ] Todo PR que muda comportamento atualiza a página do quadrante afetado ou diz por que não precisa (definição de pronto do `AGENTS.md`).
- [ ] Ao trocar de modelo ou atualizar o Claude Code, refazer o teste de roteamento e o `/doctor prompt-audit`.
- [ ] Links externos conferidos sob demanda, com o comando documentado em `reference/comandos.md`.
