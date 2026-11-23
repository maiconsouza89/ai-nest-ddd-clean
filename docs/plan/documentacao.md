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
> - [ ] Passo 12: dividir o guia de pesquisa
> - [ ] Passo 13: how-tos e skills-ponteiro
> - [ ] Passo 14: tutoriais
> - [ ] Passo 15: remover `docs/research/`

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
| Estrutura de pastas | `reference/estrutura-de-pastas.md` |
| Camadas | `reference/camadas.md` (regras) e `explanation/arquitetura.md` (porquê) |
| Persistência com TypeORM | `explanation/persistencia.md` e `how-to/gerar-migration.md` |
| Módulos independentes; dependências e contratos | `explanation/comunicacao-entre-modulos.md` |
| Shared kernel | `explanation/shared-kernel.md` |
| Autenticação e ownership | `explanation/autenticacao.md` (o `reference/autenticacao.md` já existe) |
| Agregados e comunicação entre módulos | `explanation/agregados.md` |
| Transações, concorrência e eventos | `explanation/consistencia-e-eventos.md` e `how-to/publicar-evento-de-integracao.md` |
| Paginação | `how-to/paginar-listagem.md` |
| Modelagem do domínio | `explanation/modelagem-do-dominio.md` |
| Infra: configuração, jobs, cache, serviços externos | how-tos por tarefa e `reference/variaveis-de-ambiente.md` |
| Qualidade | `reference/qualidade.md` |
| Operação | `reference/operacao.md` (health, logs, tracing) |
| Pragmatismo e checklist | `explanation/pragmatismo.md` e `how-to/revisar-um-modulo.md` |
| Referências | Seção "Leituras" no `docs/README.md` |

**Faça:** uma seção por vez:

1. Gere a página com o `plop doc`.
2. Mova o texto e divida o que mistura tipos.
3. Confira cada trecho de código contra o código atual.
4. No guia, troque a seção por um link para o novo destino.
5. Atualize a tabela de rotas do `AGENTS.md`.

**Pronto quando:** a seção virou link no guia, a página nova passa no `docs:check` e aparece no índice do `docs/README.md`.

### Passo 13: how-tos e skills-ponteiro

**Por quê:** num how-to, o humano lê o passo a passo. Numa skill, a descrição fica sempre visível para o Claude, e o corpo só carrega quando a skill é usada.

**Faça:**

- Escreva os how-tos que a fase 1 deixou só em `reference/comandos.md`: rodar migrations e seeds, criar um módulo, rodar um teste específico, resetar o ambiente, publicar evento de integração.
- Crie skills-ponteiro **só** para os procedimentos que se repetem. Os candidatos são criar módulo, gerar migration e publicar evento de integração.
- Cada skill fica em `.claude/skills/<nome>/SKILL.md`. A `description` começa pelo gatilho ("Use ao …"), e o corpo diz "siga `docs/how-to/x.md`; verifique com `npm run …`".

**Pronto quando:** em uma sessão nova, um pedido como "crie um módulo billing" faz o Claude escolher a skill sem que ela seja citada, e o how-to funciona seguido à mão.

### Passo 14: tutoriais

**Por quê:** o tutorial é onde o leitor aprende fazendo. Um tutorial que quebra afasta quem está começando.

**Faça:**

- **`tutorials/01-do-clone-ao-primeiro-pedido.md`:** registrar, fazer login, criar o pedido, fechar e pagar. Os passos seguem o mesmo fluxo de um teste e2e existente ou novo, que serve de verificação do tutorial. Cite o arquivo do teste no tutorial.
- **`tutorials/02-construindo-do-zero.md`:** mova o `docs/plan/passo-a-passo.md`, acrescente `type: tutorial` e corrija os links (o `evolucao.md` o chama de "roteiro original").

**Pronto quando:** o tutorial 01 seguido à mão num banco vazio funciona, o e2e correspondente passa, e nenhum link para o `passo-a-passo.md` antigo sobra.

### Passo 15: remover `docs/research/`

**Faça:** quando todas as seções do guia tiverem virado link, apague o arquivo e a pasta. Atualize as referências no `CLAUDE.md`, no `AGENTS.md`, no `evolucao.md` e nos ADRs.

**Pronto quando:** `grep -r "research/" .` (fora de `node_modules` e `dist`) não encontra nada, e o `docs:check` passa.

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
- [ ] **Passo 12:** cada seção migrada virou link no guia e aparece no índice. Os trechos de código foram conferidos contra o código.
- [ ] **Passo 13:** cada skill é escolhida pelo Claude a partir de um pedido natural, sem ser citada. Cada how-to funciona seguido à mão.
- [ ] **Passo 14:** o tutorial 01 funciona num banco vazio, e o e2e espelho passa.
- [ ] **Passo 15:** nenhuma referência a `docs/research/` sobra no repositório.

### Contínuo (depois da entrega)

- [ ] Todo PR que muda comportamento atualiza a página do quadrante afetado ou diz por que não precisa (definição de pronto do `AGENTS.md`).
- [ ] Ao trocar de modelo ou atualizar o Claude Code, refazer o teste de roteamento e o `/doctor prompt-audit`.
- [ ] Links externos conferidos sob demanda, com o comando documentado em `reference/comandos.md`.
