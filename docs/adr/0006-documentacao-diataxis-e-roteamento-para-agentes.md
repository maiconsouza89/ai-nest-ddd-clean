---
status: accepted
---

# Documentação em Diátaxis com roteamento para agentes

A documentação serve a humanos e a agentes, mas existe uma vez só. Os humanos leem `docs/`, organizado nos quatro quadrantes do [Diátaxis](https://diataxis.fr/): tutoriais, how-tos, referência e explicação. Os agentes recebem uma camada fina de roteamento (`AGENTS.md`, `CLAUDE.md`, `.claude/rules/` e `.claude/skills/`) que aponta para `docs/` e não tem texto próprio.

O plano de execução está em `docs/plan/documentacao.md`.

## Decisões

### Fonte da verdade

1. `docs/` é a fonte da verdade. Os arquivos de agente citam caminhos de `docs/` em texto simples, sem `@docs/...`, porque o import carrega o arquivo inteiro em toda sessão. O único conteúdo repetido é um resumo dos comandos de verificação no `AGENTS.md`, que o agente usa em quase toda tarefa.
2. O `AGENTS.md` é o roteador neutro, lido por qualquer agente. O `CLAUDE.md` começa com `@AGENTS.md` e acrescenta só o que é exclusivo do Claude Code: a pesquisa com o Context7 e o fluxo de entrega (`/simplify` → `/code-review`).
3. Todo PR que muda comportamento atualiza a página do quadrante afetado, ou diz por que não precisa. Essa definição de pronto fica no `AGENTS.md`.

### Onde fica cada tipo de conhecimento

1. O conhecimento de cada módulo fica em `docs/reference/modules/<módulo>.md`: propósito, linguagem ubíqua, contrato público, eventos, invariantes, dependências e schema.
2. O agente descobre esse arquivo por dois caminhos: a tabela de rotas do `AGENTS.md` ("vai fazer X → leia Y") e uma única regra-ponteiro, `.claude/rules/modules.md`, com `paths: ["src/modules/**"]`. A regra só carrega quando o agente lê um arquivo do módulo.
3. Convenções de camada: o que dá para verificar vira regra do dependency-cruiser ou do ESLint, com mensagem que cita a doc. O que exige julgamento vira texto em `docs/reference/camadas.md`, com regras-ponteiro por camada. Uma convenção fica num lugar só, nunca nos dois.
4. Procedimentos: o passo a passo fica em `docs/how-to/`. Os procedimentos frequentes ganham uma skill-ponteiro em `.claude/skills/`, cuja descrição traz o gatilho e cujo corpo aponta para o how-to.
5. A linguagem ubíqua fica numa seção do doc de cada módulo, perto do código que a usa. O `docs/reference/glossario.md` guarda os termos compartilhados entre módulos e um índice A–Z de todos os termos, com link para o módulo dono.

### Formato

1. Pastas em inglês (os nomes do Diátaxis), nomes de arquivo e conteúdo em pt-BR. Os docs de módulo usam o nome do módulo no código (`orders.md`).
2. `docs/adr/` e `docs/plan/` ficam fora dos quadrantes: o ADR é um registro imutável e o plano é trabalho interno. O `docs/research/` é dividido entre os quadrantes e depois removido.
3. Toda página de quadrante tem frontmatter `type:` igual à pasta onde está (`tutorial`, `how-to`, `reference` ou `explanation`) e nasce do `npm run plop doc <tipo> <nome>`, com o formato do seu tipo.
4. Só Markdown, sem site gerado.

### Verificação e entrega

1. O `npm run docs:check` entra no `npm run ci`. Ele confere todo `*.md` que o `.gitignore` não exclui, com duas ferramentas:
   - o `markdownlint-cli2`, para o lint do Markdown. O `MD013` (comprimento de linha) fica desligado, porque os docs usam um parágrafo por linha e tabelas largas. O `MD024` (título repetido) só vale entre irmãos, porque um checklist repete os títulos das seções que resume. O `MD041` (primeira linha é título) não vale no `CLAUDE.md`, que começa com `@AGENTS.md`;
   - o `remark-cli` com dois plugins. O `remark-validate-links` confere os links e âncoras locais, sem rede, inclusive as âncoras em outros arquivos, o que o markdownlint não faz. O plugin do projeto, `scripts/remark-docs-rules.mjs`, confere o `type:` de cada página de quadrante, barra imports `@caminho` nos `AGENTS.md` e `CLAUDE.md` (exceto o `@AGENTS.md` no `CLAUDE.md`) e confere se cada caminho de `docs/` citado em texto simples nos arquivos de agente e em `.claude/` existe. O `remark-validate-links` só enxerga links, e esses ponteiros não são links.
2. Links externos ficam fora do CI, porque dependem da rede e de sites de terceiros. São conferidos sob demanda com `npm run docs:links` (lychee via Docker).
3. O Markdown continua fora do Prettier (`*.md` no `.prettierignore`). O Prettier alinha as colunas das tabelas, e os docs têm células longas: cada linha da tabela passaria de 300 caracteres, e mudar uma célula reescreveria a tabela inteira no diff. O estilo do Markdown fica com o markdownlint.
4. Nenhum hook. As regras sem exceção (por exemplo, nunca rodar `docker volume prune`) continuam como texto no `AGENTS.md`.
5. Entrega em três etapas: fundação (este ADR, `docs:check`, templates, referência operacional e arquivos de agente), módulos e glossário, e o resto sob demanda, quando o assunto for tocado.

## Considered Options

- **Só o `CLAUDE.md`, como antes:** era a única cópia dos comandos, do setup e das convenções. Um humano sem o Claude não tinha onde encontrá-los, e outros agentes não o leem.
- **`CLAUDE.md` como symlink para o `AGENTS.md`:** não deixa lugar para o que é só do Claude, e symlinks se comportam mal no Windows e em algumas ferramentas.
- **Textos próprios para os agentes:** duas versões do mesmo fato divergem. Com ponteiros, o agente lê a mesma página que o humano.
- **`AGENTS.md` dentro de cada módulo:** o Claude Code lê `CLAUDE.md`, não `AGENTS.md`, então cada módulo precisaria dos dois arquivos. E o conhecimento do módulo ficaria fora de `docs/`, escondido do humano que navega pela documentação.
- **Regras em `.claude/rules/` com o conteúdo do módulo:** só o Claude as lê, e o conteúdo sairia de `docs/`.
- **Uma regra-ponteiro por módulo:** cinco arquivos quase iguais. Uma regra com `paths` amplo e o nome do módulo no caminho cobre todos, inclusive os módulos gerados depois.
- **Convenções de camada só como texto:** o agente pode não ler a doc. A mensagem de erro de um check chega sempre.
- **Glossário central único:** separa o termo do módulo que o define e mistura sentidos que só valem num contexto.
- **Pastas e arquivos em pt-BR:** os nomes dos quadrantes em inglês são os do Diátaxis e de quem já o conhece. O conteúdo segue em pt-BR, como o resto do repositório.
- **Hooks para as regras sem exceção:** bloqueariam o comando de forma determinística, mas acrescentam configuração para manter, e só o Claude Code os executa. Reavaliar se um agente violar uma dessas regras.
- **`lychee --offline --include-fragments` para os links locais:** é um binário Rust. No CI, exigiria Docker ou uma instalação à parte, e o `npm run ci` deixaria de rodar só com o Node.
- **Prettier no Markdown:** ver a decisão sobre o `.prettierignore` acima.
- **Site gerado (Docusaurus, MkDocs):** acrescenta build e deploy. O GitHub já renderiza Markdown, e os agentes leem os arquivos crus.
- **Reescrever toda a documentação de uma vez:** o Diátaxis recomenda melhorar aos poucos, em pedaços pequenos. Um PR gigante seria difícil de revisar e de validar contra o código.

## Consequences

- Cada fato tem um endereço em `docs/`. Mudar um fato é editar uma página, e os ponteiros continuam válidos.
- Um caminho citado que deixa de existir quebra o CI, pelo `docs:check`. Sem ele, os ponteiros apodreceriam em silêncio.
- O contexto fixo do agente fica pequeno (meta de menos de 200 linhas para o `CLAUDE.md` com o `AGENTS.md` expandido). O resto carrega sob demanda, pelas regras com `paths`, pelas skills e pela leitura das páginas.
- Agentes que não são o Claude Code leem o `AGENTS.md` e seguem a tabela de rotas, mas não têm as regras-ponteiro nem as skills.
- Todo módulo novo nasce com a sua doc, pelo template do `plop module`.
- O roteamento depende do comportamento do agente e não é verificado no CI. Ele é conferido à mão, com perguntas de teste numa sessão nova, ao trocar de modelo ou atualizar o Claude Code.
