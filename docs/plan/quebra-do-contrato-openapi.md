# Plano da detecção no CI de mudanças do OpenAPI que quebram clientes (#23)

A issue #23 pede que o CI avise quando um PR muda o contrato HTTP de um jeito que quebra clientes, como remover um campo ou tornar um campo obrigatório. A proposta: um script gera o `openapi.json` a partir do `AppModule`, sem subir o servidor, e o guarda no repositório. O CI confere que o arquivo guardado está atualizado e o compara com o da base do PR, com o `oasdiff`, falhando numa mudança que quebra clientes.

**Mudanças em relação ao texto da issue:**

- **O documento de hoje não descreve o corpo das respostas de sucesso.** Os controllers devolvem o resultado do caso de uso sem tipo de resposta, e o plugin da CLI gera `{ "type": "object" }` (`GET /v1/orders`), um schema sem propriedades (`ProductOrmEntity`) ou nenhuma resposta de sucesso (`POST /v1/auth/login`). Remover um campo dessas respostas não muda o `openapi.json`, e nenhuma ferramenta de diff acusa. O que o documento já descreve, e o `oasdiff` protege: rotas, parâmetros, corpos de requisição, status e o schema `ProblemDetailsResponse` de toda resposta de erro. O "Pronto quando" da issue se prova removendo um campo obrigatório do `ProblemDetailsResponse`. Documentar as respostas de sucesso é a decisão "Escopo das respostas", abaixo.
- **O documento sai do `dist/`, e não do código-fonte.** Os schemas dos DTOs vêm do plugin da CLI do Nest, que só roda no `nest build` e no `nest start` ([Operação](../reference/operacao.md#swagger)). O script compila antes de gerar.
- **A comparação só funciona a partir do segundo PR.** No PR que cria o `openapi.json`, a base não tem o arquivo, e o job de comparação passa sem comparar. A prova de que um PR que quebra o contrato falha vem num PR de teste depois do merge.

Tudo entra em **um PR**, na branch `ci/quebra-do-contrato-openapi`. O plano nasce e é apagado no mesmo PR. O registro, com a prova feita depois do merge, fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

As decisões abaixo foram fechadas com o dono do repositório em 2026-11-25, antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Escopo das respostas | Este PR fica com o mecanismo (gerador, arquivo guardado, conferência e `oasdiff`), e uma issue nova documenta as respostas de sucesso, com uma classe `*.response.ts` por resposta e o envelope da paginação. Com o mecanismo pronto, cada resposta documentada passa a ser protegida sem mudar o CI. A alternativa é documentar tudo neste PR: são umas 10 rotas em 3 módulos, uma convenção nova em `camadas.md` e um schema genérico para a paginação, trabalho maior que o resto da issue, que tem prioridade baixa |
| Onde fica o documento | `openapi.json` na raiz, em JSON. A raiz é onde as ferramentas e os exemplos do `oasdiff` procuram. Em `docs/`, o arquivo cairia no filtro "PR só de Markdown" do job `changes` e no domínio das páginas Diátaxis. JSON é a saída do `SwaggerModule.createDocument` e não pede dependência para YAML |
| Gerador | `src/openapi.ts`, compilado para `dist/openapi.js`, ao lado do `main.ts` e do `bootstrap.ts`. Em TypeScript, ele passa pelo `typecheck`, pelo `lint` e pelos aliases `#shared/*`, e roda sobre o mesmo build que tem os metadados do plugin |
| Subir a app sem Postgres e Redis | `NestFactory.create(AppModule, { preview: true, abortOnError: false, logger: false })`. No modo preview, o Nest monta o grafo de módulos, mas não chama construtor, factory nem hook de provider: o TypeORM, o ioredis e o BullMQ não conectam. O `SwaggerModule.createDocument` só precisa do protótipo dos controllers e dos metadados. Sem `app.init()` nem `listen()`. O `abortOnError: false` faz uma falha virar exceção com mensagem, e não um `process.abort()` |
| Variáveis de ambiente | O `validateEnv` do `ConfigModule.forRoot` roda no import do `AppModule` e exige `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SMTP_URL` e `EMAIL_FROM`. O gerador carrega o `.env.example` para as que faltam (`loadEnvFiles(process.env, ['.env.example'])`) e só então importa o `AppModule`, por `await import()`. Os valores não chegam a ser usados: no preview nada conecta |
| Versão na URL | O `configureApp` lê o `ConfigService`, que no preview não existe, e falha. A opção do `enableVersioning` sai do `configureApp` para uma função ou constante exportada do `app.setup.ts`, usada pelos dois. Sem ela, as rotas saem sem o `/v1` |
| Montagem do documento | O `swagger.setup.ts` ganha um `createSwaggerDocument(app)` com o `DocumentBuilder` e os `extraModels`. O `setupSwagger` passa a chamá-lo. O arquivo guardado e o `/docs-json` saem da mesma configuração |
| Ordem das chaves | O gerador ordena as chaves de `paths` e de `components.schemas` e grava com `JSON.stringify(documento, null, 2)` e uma quebra de linha no fim. Sem isso, a ordem segue a dos `imports` do `AppModule`, e reordenar um módulo mexeria no arquivo inteiro. O resto fica na ordem do Swagger, que já é estável |
| Prettier | `openapi.json` no `.prettierignore`, como o `package-lock.json`. O Prettier junta arrays curtos numa linha, e o arquivo sairia diferente da saída do gerador. O arquivo é gerado e não se edita à mão |
| Conferência do arquivo | `npm run openapi:check`: compila, gera em memória e compara com o `openapi.json`. Diferente, falha com a instrução `npm run openapi:generate`. Entra no `ci:static`, então roda no job `check` e no `npm run ci` local. O custo é um `nest build`, uns 5 s |
| Instalação do `oasdiff` | O binário do release do GitHub, numa versão fixa, com o SHA-256 conferido contra um valor escrito no workflow. A alternativa, a action `oasdiff/oasdiff-action/breaking`, entraria no lockfile, mas é uma action Docker que monta a imagem a partir de `tufin/oasdiff:v<versão>`, uma tag mutável que o lockfile não cobre. Ela também manda os dois documentos para o oasdiff.com por padrão (`review: true`) e comenta no PR com `pull-requests: write`. O preço do binário: o Dependabot não o atualiza, e a versão é conferida à mão, como o Node |
| Versão do `oasdiff` | A latest estável na hora do passo 3. Em 2026-11-25, a v1.41.0, com o SHA-256 `96365453163118e6503eb71742643d9ee67f91aedbaadd1a1ce9c6213e3b71c7` para `oasdiff_1.41.0_linux_amd64.tar.gz`, igual ao do `checksums.txt` do release. O projeto solta versões com frequência: confira de novo no passo 3 |
| Onde a comparação roda | Um job `openapi` no `ci.yml`, só em PR, dentro do `needs` do job `ci`. O check obrigatório `ci` passa a cobri-lo, sem mudar o `setup-github.mjs` nem rodar o `npm run github:setup`. A alternativa é um workflow próprio, com um check obrigatório novo no ruleset: dá um nome visível à falha, mas pede a mudança no script e o dono rodando o setup de novo |
| Comparação | `oasdiff breaking HEAD^1:openapi.json HEAD:openapi.json`, pela sintaxe de revisão do git que o `oasdiff` lê. No PR, o checkout é o merge na base, e o `HEAD^1` é a ponta da base, o mesmo truque do `VITEST_ARGS`: basta `fetch-depth: 2`. Compara os dois arquivos guardados, sem compilar a base: o job `check` garante que o do PR está atualizado. Se a base não tem o arquivo, o job avisa e passa |
| Severidade | `fail-on: ERR`. `-f githubactions` no CI, para cada quebra virar uma anotação no PR |
| Campo removido do corpo da requisição | Subir o `request-property-removed` de `WARN` para `ERR` no arquivo de severidades. O `ValidationPipe` usa `forbidNonWhitelisted`, então um cliente que ainda manda o campo removido recebe 400 `VALIDATION_FAILED`. Para o `oasdiff`, essa mudança não quebra, porque ele supõe que o servidor ignora campo a mais |
| Quebra intencional | Um arquivo de exceções do `oasdiff` (`err-ignore`), versionado, com uma linha por quebra aceita, a regex da mensagem e o número do PR. A linha passa pela revisão do PR, e o título leva o `!` e o parágrafo `BREAKING CHANGE` do `CONTRIBUTING.md`. As alternativas: um rótulo no PR, que libera qualquer quebra do PR e pede o gatilho `labeled` no `ci.yml`; o `!` no título, que pede o gatilho `edited` e roda o CI inteiro a cada edição do título; ou o bypass do ruleset, sem registro. O caminho normal continua o da [convenção](../reference/convencoes.md#versionamento-da-api-http): uma `/v2` é aditiva e não falha |
| Arquivos do `oasdiff` | `.github/oasdiff/config.yaml` (`fail-on`, `severity-levels` e `err-ignore`), `.github/oasdiff/severity-levels.txt` e `.github/oasdiff/err-ignore.txt`. Os caminhos do config são relativos à pasta dele. Local e CI rodam o mesmo comando com `--config .github/oasdiff/config.yaml` |
| Prova do "Pronto quando" | No PR, um teste local com o binário contra commits temporários. Depois do merge, com o ok do dono, um PR de teste em rascunho tira o `@ApiProperty` do `code` do `ProblemDetailsResponse` (o campo continua no tipo, e o `typecheck` passa), mostra o job `openapi` falhando e é fechado sem merge. A issue fecha depois dessa prova |
| Tipo do commit e do PR | `ci`: muda o que o CI confere, sem mudar o comportamento da API |
| ADR | Não entra. O porquê das escolhas cabe na seção CI do `comandos.md` e no Swagger do `operacao.md`, e nenhuma decisão registrada muda |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Documentar as respostas de sucesso | Issue nova (decisão "Escopo das respostas"). Ela prova o "Pronto quando" da #23 numa resposta de sucesso |
| Exigir subir o `info.version` numa quebra (`--fail-on MISSING-VERSION-BUMP`) | Não entra: a versão da API vai na URL ([Convenções](../reference/convencoes.md#versionamento-da-api-http)), e não no `info.version` |
| Changelog do contrato no resumo do job ou num comentário do PR | Não entra. As anotações do `-f githubactions` mostram cada quebra no PR |
| Revisão no oasdiff.com e o oasdiff Pro | Não entra: o documento não sai do CI |
| Lint do documento (`oasdiff validate`, Spectral) | Não entra. Se o dono quiser, vira issue |
| Atualizar o `oasdiff` pelo Dependabot | O Dependabot não tem ecossistema para binário de release. A versão fica na lista do que se confere à mão, em [Versões e exceções](../reference/versoes-e-excecoes.md#atualização-automática) |
| Gerar cliente ou SDK a partir do `openapi.json` | Não entra |
| Swagger em produção | Sem mudança: o `/docs` continua fora de `NODE_ENV=production` |

## Referências

- Issue #23: `gh issue view 23`. Registro da #13 (lockfile, `sha_pinning_required`, políticas e `setup-github.mjs`): `gh issue view 13 --comments`.
- `@nestjs/swagger` 12.1.2 e `@nestjs/core` 12.6.0, instalados. Consultados no Context7 em 2026-11-25:
  - `/nestjs/docs.nestjs.com`, "CI/CD integration": com `preview: true`, os construtores e os hooks de controllers, enhancers e providers não rodam, e nada conecta no banco;
  - `/nestjs/docs.nestjs.com`, "First steps": o `abortOnError: false` faz a falha na criação virar exceção;
  - `/nestjs/docs.nestjs.com`, "OpenAPI → Introduction": o documento do `createDocument` é serializável e pode ser gravado em JSON;
  - `/nestjs/docs.nestjs.com`, "CLI plugin": o plugin roda na compilação. O `PluginMetadataGenerator` e o `SwaggerModule.loadPluginMetadata` são para compilar sem o `tsc` e ficam de fora.
- Código do Nest lido em `node_modules`, para confirmar o preview:
  - `@nestjs/core/injector/injector.js` (`instantiateClass`): no preview, devolve o protótipo sem chamar o construtor nem a factory;
  - `@nestjs/swagger/dist/swagger-scanner.js` e `swagger-explorer.js`: o scanner percorre `container.getModules()` e usa o `metatype` e o protótipo do controller;
  - `@nestjs/core/nest-factory.js`: sem `abortOnError: false`, uma falha chama `process.abort()`.
- Teste feito em 2026-11-25, num build do `HEAD` (`be5b794`) fora do checkout, com o Postgres e o Redis apontando para uma porta fechada:
  - o documento sai em 100 a 250 ms, com as 15 rotas e 14 schemas;
  - sai igual em duas execuções e com `NODE_ENV=test` ou `production` e os workers ligados ou desligados;
  - sem as variáveis obrigatórias, o `validateEnv` falha no import do `AppModule`;
  - o `configureApp` falha no preview (`Cannot read properties of null (reading 'get')`);
  - o Prettier reformata o JSON do `JSON.stringify(…, null, 2)`.
- `oasdiff`, consultado no Context7 em 2026-11-25 (`/oasdiff/oasdiff`): `docs/BREAKING-CHANGES.md` (`--fail-on`, `--err-ignore`, `--severity-levels`), `docs/DEPRECATION.md` (remover uma rota `deprecated` sem `x-sunset` é `INFO`; com o `x-sunset` no futuro, `ERR`; remover um campo opcional da resposta é `WARN`), `docs/GIT-REVISION.md` (sintaxe `rev:caminho`) e `docs/CONFIG-FILES.md` (caminhos relativos à pasta do config).
- Releases conferidos com o `gh` em 2026-11-25: `oasdiff/oasdiff` v1.41.0 (Apache-2.0), com o SHA-256 da tabela de decisões e sem attestation; `oasdiff/oasdiff-action` v0.2.3, action Docker com `FROM tufin/oasdiff:v1.41.0` e `review: true` por padrão. O nome `oasdiff` no npm é um placeholder de segurança, sem código.
- Teste do `oasdiff` 1.41.0 feito em 2026-11-25, contra o documento gerado:
  - tirar o `code` do `ProblemDetailsResponse`: 4 `response-required-property-removed`, saída 1;
  - campo obrigatório novo no `CreateOrderItemRequest`: `new-required-request-property`, saída 1;
  - tirar a rota `POST /v1/orders/{id}/cancel`: `api-path-removed-without-deprecation`, saída 1;
  - tirar o `password` do `LoginRequest`: `request-property-removed` só como `WARN`, saída 0. Com o arquivo de severidades, `ERR` e saída 1;
  - uma linha no `err-ignore` libera a quebra, com saída 0;
  - o `HEAD^1:openapi.json` funciona num clone com dois commits, e a revisão ausente sai com 102 e a mensagem do `git`.
- Código:
  - `src/bootstrap.ts`, `src/main.ts` e `src/app.setup.ts`;
  - `src/app.module.ts`;
  - `src/shared/infra/http/swagger.setup.ts` e `problem-details.response.ts`;
  - `src/shared/infra/config/env.validation.ts` e `load-env-files.ts`;
  - `nest-cli.json` (plugin do Swagger) e `tsconfig.build.json`;
  - `test/docs.e2e-spec.ts`;
  - `.github/workflows/ci.yml`, `.github/workflows/actions.lock` e `.github/actionlint.yaml`;
  - `scripts/setup-github.mjs`, que não muda com a recomendação de "Onde a comparação roda".
- Páginas a mudar:
  - `docs/reference/operacao.md` (seção Swagger);
  - `docs/reference/comandos.md` (Verificação e CI);
  - `docs/reference/convencoes.md` (Versionamento da API HTTP);
  - `docs/reference/versoes-e-excecoes.md` (Atualização automática);
  - `docs/how-to/criar-um-modulo.md`;
  - `.github/CONTRIBUTING.md` (Quebra);
  - `AGENTS.md` (Armadilhas).
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): o `ci.yml` (#21), o `package.json` e o `package-lock.json` (#17, #21 e #22) e o `comandos.md` (#21 e #22). Com a recomendação do binário, o `actions.lock` não muda: o job novo usa só o `actions/checkout`, que já está nele.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Antes de cada passo, leia as páginas da tabela de rotas do `AGENTS.md` para o assunto. Aqui: `docs/reference/operacao.md`, `docs/reference/comandos.md#ci`, `docs/adr/0012-cadeia-de-suprimentos-do-ci.md` e `docs/reference/convencoes.md`.
- Antes de usar uma API do `@nestjs/swagger` ou do `@nestjs/core` que o repositório ainda não usa, confira no Context7. O `oasdiff` também está no Context7 (`/oasdiff/oasdiff`).
- Escreva as páginas de forma atemporal, com data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR, comentário na issue e mudança de configuração do repositório no GitHub só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Gerador e `openapi.json` guardado | ✅ |
| 3 | Config do `oasdiff` e teste local | ✅ |
| 4 | Job `openapi` no CI | ⬜ |
| 5 | Documentação | ⬜ |
| 6 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha G com a branch `ci/quebra-do-contrato-openapi` a partir da `main` atualizada e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Traga este plano para a branch.
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #23 como 🟡.
4. `npm run docs:check`.
5. Commit: `docs(plan): plano da detecção de quebra do contrato OpenAPI (#23)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: gerador e `openapi.json` guardado

1. `src/app.setup.ts`: tire a opção do `enableVersioning` do `configureApp` para uma constante ou função exportada, usada pelo `configureApp` e pelo gerador. O nome fica a critério de quem executa.
2. `src/shared/infra/http/swagger.setup.ts`: extraia `createSwaggerDocument(app)`, com o `DocumentBuilder`, o `addGlobalResponse` e os `extraModels`. O `setupSwagger` chama o `createSwaggerDocument`, monta o `/docs` e continua devolvendo o documento, que o `test/docs.e2e-spec.ts` usa.
3. `src/openapi.ts`:
   - `import 'reflect-metadata'`, depois `loadEnvFiles(process.env, ['.env.example'])`, e só então `await import('./app.module.js')`. Comente por que a ordem importa: o `validateEnv` roda no import do `AppModule`;
   - `NestFactory.create(AppModule, { preview: true, abortOnError: false, logger: false })`, sem `init()` nem `listen()`. Comente por que o preview: nada conecta no Postgres nem no Redis;
   - a versão na URL, pelo que saiu do `configureApp` no item 1;
   - `createSwaggerDocument(app)`, as chaves de `paths` e de `components.schemas` em ordem alfabética, e `JSON.stringify(documento, null, 2)` com quebra de linha no fim;
   - sem argumento, grava o `openapi.json` na raiz. Com `--check`, compara com o arquivo e, se diferir ou faltar, sai com 1 e a mensagem "openapi.json desatualizado: rode npm run openapi:generate e commite o arquivo";
   - `await app.close()` no fim;
   - se o `no-restricted-imports` do `main.ts` ou outra regra do lint estranhar o `import()` dinâmico, siga a mensagem do erro. Não desligue a regra.
4. `package.json`:
   - `"openapi:generate": "nest build && node dist/openapi.js"`;
   - `"openapi:check": "nest build && node dist/openapi.js --check"`;
   - `openapi:check` no fim do `ci:static`.
5. `.prettierignore`: `openapi.json`, com um comentário de uma linha dizendo que o arquivo é gerado.
6. Rode `npm run openapi:generate` e commite o `openapi.json`.
7. Confira:
   - com o stack do docker-compose parado, ou com `DATABASE_URL` e `REDIS_URL` apontando para uma porta fechada, o `openapi:generate` termina em poucos segundos, sem tentar conectar;
   - duas execuções seguidas não mudam o arquivo;
   - com o `start:dev` no ar, o `/docs-json` tem as mesmas rotas e os mesmos schemas do arquivo, fora a ordem das chaves. Compare as duas versões com as chaves ordenadas, por exemplo com `jq -S`. Pare o `start:dev` depois;
   - mudar um DTO sem gerar de novo faz o `npm run openapi:check` falhar com a mensagem do item 3;
   - `npm run typecheck`, `npm run lint`, `npm run arch`, `npm run format:check` e `npm test` passam. O `npm run test:e2e -- docs` passa com o `setupSwagger` novo.
8. Commit: `ci: gera o openapi.json do AppModule e confere que está atualizado (#23)`.

### Passo 3: config do `oasdiff` e teste local

1. Confira a latest estável do `oasdiff` (`gh release list -R oasdiff/oasdiff`) e o SHA-256 do `oasdiff_<versão>_linux_amd64.tar.gz` no `checksums.txt` do release. Leia as notas das versões depois da v1.41.0, atrás de mudança no `breaking`, no `--fail-on`, no formato do `err-ignore` ou no `--config`.
2. `.github/oasdiff/config.yaml`, com um comentário de cabeçalho apontando para `docs/reference/comandos.md#ci`:
   - `fail-on: ERR`;
   - `severity-levels: severity-levels.txt`;
   - `err-ignore: err-ignore.txt`.
3. `.github/oasdiff/severity-levels.txt`: `request-property-removed err`, com o motivo num comentário (o `forbidNonWhitelisted` do `ValidationPipe`). Confira na doc da versão escolhida se o arquivo aceita comentário com `#`. Se não aceitar, o motivo vai só no `comandos.md`.
4. `.github/oasdiff/err-ignore.txt`: só o cabeçalho, em comentários, com a regra:
   - uma linha por quebra aceita, com a regex da mensagem do `oasdiff` e o número do PR;
   - o PR que acrescenta a linha tem `!` no título e o parágrafo `BREAKING CHANGE`;
   - quem acrescenta uma linha apaga as de PRs já mergeados, que não casam com mais nada e poderiam esconder uma quebra igual no futuro.

   Confira o formato na doc da versão escolhida. A doc antiga fala em "método e caminho mais a descrição", e o exemplo da v1.41.0 diz que cada linha é uma regex.
5. Commit: `ci: config do oasdiff com severidades e exceções (#23)`.
6. Teste local, depois do commit, num diretório próprio no scratchpad, sem instalar o binário no sistema nem commitar nada dele:
   - baixe o tarball, confira o SHA-256 e extraia;
   - num commit temporário, tire o `@ApiProperty` do `code` do `ProblemDetailsResponse` e rode `npm run openapi:generate`. Rode `oasdiff breaking HEAD^1:openapi.json HEAD:openapi.json --config .github/oasdiff/config.yaml`: sai com 1 e `response-required-property-removed`;
   - repita com o `password` tirado do `LoginRequest` (`request-property-removed`, `ERR` pelo arquivo de severidades) e com um campo obrigatório novo num DTO de requisição (`new-required-request-property`);
   - com uma linha no `err-ignore.txt` para uma das quebras, o comando sai com 0;
   - desfaça os commits temporários com `git reset --hard` até o commit do item 5, só nesta branch, e confira que o `openapi:check` passa.

### Passo 4: job `openapi` no CI

1. No `.github/workflows/ci.yml`, um job `openapi`:
   - `needs: changes`, com `if: github.event_name == 'pull_request' && needs.changes.outputs.code == 'true'`. Na `main`, não há base para comparar;
   - `runs-on: ubuntu-latest`, sem Node e sem a composite de setup;
   - checkout com `fetch-depth: 2` e `persist-credentials: false`;
   - um step que confere se a base tem o arquivo (`git cat-file -e HEAD^1:openapi.json`). Sem ele, escreve um aviso (`::notice::`) e pula os próximos;
   - um step que baixa o tarball da versão escolhida no passo 3, confere o SHA-256 com `sha256sum -c` contra o valor escrito no workflow (numa `env:` do job, com a versão ao lado) e extrai o binário para o `$RUNNER_TEMP`;
   - `oasdiff breaking HEAD^1:openapi.json HEAD:openapi.json --config .github/oasdiff/config.yaml -f githubactions`;
   - um comentário que explique o `HEAD^1` (o mesmo do `VITEST_ARGS`), por que o binário e não a action, e onde atualizar a versão.
2. Acrescente o `openapi` no `needs` do job `ci` e cite-o no comentário de cabeçalho dele.
3. Rode o `actionlint` local sobre os workflows e `gh actions-lock --verify-local`. O lockfile não muda, porque o job usa só o `actions/checkout@v7.0.1`. Se um `uses:` novo entrar, rode `gh actions-lock` e revise o diff.
4. Commit: `ci: compara o openapi.json do PR com o da base pelo oasdiff (#23)`.

**Pronto quando:** no CI do PR, o job `openapi` roda, avisa que a base não tem o `openapi.json` e passa. O `check` roda o `openapi:check` e passa. O `ci` e o `verify-lockfile` passam.

### Passo 5: documentação

1. `docs/reference/operacao.md`, seção Swagger:
   - uma linha "Documento guardado": o `openapi.json` na raiz, gerado pelo `src/openapi.ts` a partir do `dist/`, no modo preview do Nest, sem Postgres nem Redis, com as variáveis que faltam tiradas do `.env.example`;
   - uma linha "Montagem" com o `createSwaggerDocument` e o `setupSwagger`;
   - na frase sobre o plugin, que o `openapi.json` sai do build e por isso tem os schemas, ao contrário do documento dos testes do Vitest;
   - o que o documento não descreve: o corpo das respostas de sucesso, até a issue nova.
2. `docs/reference/comandos.md`:
   - em Verificação, as linhas do `openapi:generate` e do `openapi:check`, e o `openapi:check` na linha do `ci:static`;
   - em CI, o job `openapi` na tabela de jobs e um bullet "Quebra do contrato" com: a comparação com a base, a severidade, o `request-property-removed` como `ERR` e o porquê, o `err-ignore.txt` para uma quebra intencional, o binário com o SHA-256 e onde atualizar a versão, e o comando local, com o binário baixado à mão (`oasdiff breaking origin/main:openapi.json openapi.json --config .github/oasdiff/config.yaml`);
   - um bullet "Conflito no `openapi.json`": não resolva à mão; rode `npm run openapi:generate` depois do rebase.
3. `docs/reference/convencoes.md`, Versionamento da API HTTP: na linha "Mudança que quebra", o CI acusa a quebra pelo `oasdiff` ([Comandos → CI](../reference/comandos.md#ci)). Uma rota `deprecated` removida sem `x-sunset` passa como `INFO`, e com o `x-sunset` no futuro falha. Na linha "Mudança aditiva", um campo obrigatório novo na requisição quebra, e o CI acusa.
4. `docs/reference/versoes-e-excecoes.md`, Atualização automática: o `oasdiff` entra na lista do que se confere à mão, ao lado do Node, com o lugar da versão e do SHA-256 no `ci.yml`. E uma linha para o PR do Dependabot do `@nestjs/swagger` ou do grupo `nestjs`: se o documento mudar, o `check` falha, e quem fecha o PR roda o `openapi:generate` na mesma branch, como faz com as imagens.
5. `docs/how-to/criar-um-modulo.md`: depois de criar o controller e os DTOs, rode `npm run openapi:generate` e commite o `openapi.json`.
6. `.github/CONTRIBUTING.md`, bullet "Quebra": uma quebra do contrato HTTP aceita de propósito leva também a linha no `.github/oasdiff/err-ignore.txt`, com o link para a seção CI do `comandos.md`.
7. `AGENTS.md`, Armadilhas: "**OpenAPI:** mudou controller, DTO ou decorator do Swagger, rode `npm run openapi:generate` e commite o `openapi.json`. Nunca o edite à mão." Confira com o dono se a frase cabe, porque o `AGENTS.md` é curto de propósito.
8. `npm run docs:check`.
9. Commit: `docs: openapi.json guardado e detecção de quebra do contrato (#23)`.

### Passo 6: verificação, revisão, registro e PR

1. `npm run ci`. A mudança toca o HTTP só no `swagger.setup.ts` e no `app.setup.ts`: rode também `npm run test:e2e`, com o `start:dev` deste checkout parado.
2. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar código, repita o item 1.
3. Faça rebase sobre a `main`, rode `npm run openapi:generate` (outra trilha pode ter mudado uma rota) e `npm run ci` de novo. No conflito do `package.json`, refaça o `package-lock.json` com `npm install`.
4. Com o ok do dono, faça push e abra o PR com o título `ci: detecta no CI mudança do OpenAPI que quebra clientes (#23)`. A descrição traz:
   - as três mudanças em relação à issue: as respostas de sucesso fora do documento, o documento saído do `dist/` e a prova depois do merge;
   - as decisões do plano;
   - o resultado do teste local do passo 3.
5. Com o ok do dono, deixe na issue um comentário de registro com este plano, os mesmos pontos da descrição e um checklist da fase depois do merge:
   - [ ] PR de teste em rascunho, a partir da `main`, que tira o `@ApiProperty` do `code` do `ProblemDetailsResponse` e gera o `openapi.json` de novo. O job `openapi` falha com `response-required-property-removed`, e a anotação aparece no PR. Feche o PR sem merge e apague a branch;
   - [ ] a issue nova das respostas de sucesso, aberta com o ok do dono;
   - [ ] fechar a #23.
6. Último commit da branch, `docs(plan): fecha o plano da detecção de quebra do contrato OpenAPI (#23)`:
   - apague este plano;
   - no roadmap, marque a #23 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário de registro da #23, como os das issues #19 e #15;
   - rode `npm run docs:check` de novo e faça push.
