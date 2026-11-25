---
status: accepted
---

# Cadeia de suprimentos do CI: Dependabot, CodeQL, dependency review e lockfile das actions

A regra do projeto é a latest estável de cada pacote ([Versões e exceções](../reference/versoes-e-excecoes.md)), mas a conferência era manual, com o `npm outdated` ([issue #13](https://github.com/maiconsouza89/ai-nest-ddd-clean/issues/13)). O CI não analisava o código nem os workflows atrás de vulnerabilidade, não olhava a dependência que um PR trazia e referenciava as actions por tag (`actions/checkout@v7`), que o dono da action, ou quem invadir o repositório dela, pode apontar para outro commit, como no caso do `tj-actions/changed-files` em 2025.

A cadeia de suprimentos do CI fica assim:

- **Dependabot** (`.github/dependabot.yml`) para o npm, as actions e as imagens do `docker-compose.yml`, toda segunda-feira, com cooldown, grupos e um `ignore` que espelha a tabela de exceções.
- **CodeQL** em advanced setup (`.github/workflows/codeql.yml`), com as linguagens `javascript-typescript` e `actions`, em PR, na `main` e uma vez por semana. A regra `code_scanning` do ruleset barra o PR com alerta de segurança `high` ou acima, ou de erro, nas linhas que ele muda.
- **Dependency review** (`.github/workflows/dependency-review.yml`), check obrigatório: barra a dependência nova com vulnerabilidade `high` ou acima ou com licença fora da lista permissiva.
- **Workflow lockfile** (`.github/workflows/actions.lock`, pela extensão `github/gh-actions-lock`) com o commit e a identidade do repositório de cada action, inclusive as transitivas e as da composite `.github/actions/setup`. O check `verify-lockfile` e o `sha_pinning_required` do repositório o obrigam, e a política "Require lockfile" é ligada à mão.
- **`npm audit signatures`** num step próprio do job `check`, para conferir que cada pacote instalado veio assinado do registry do npm.
- O `npm run github:setup` liga os checks obrigatórios, a regra do CodeQL, os Dependabot alerts e security updates e o `sha_pinning_required`.

Como usar: [Comandos → CI](../reference/comandos.md#ci) e [Versões e exceções → Atualização automática](../reference/versoes-e-excecoes.md#atualização-automática).

## Considered Options

- **Renovate no lugar do Dependabot:** agrupa e agenda com mais opções, mas pede um app de terceiro com escrita no repositório. Um template não deve exigir isso de quem o copia, e o Dependabot já cobre os três ecossistemas, os grupos, o cooldown e o `ignore`.
- **CodeQL em default setup:** liga pela interface, sem arquivo. A config não fica versionada nem passa por revisão em PR, e o default setup ligado desativa o advanced. **Semgrep ou Sonar:** pedem conta ou token de fora, e o CodeQL é gratuito em repositório público e se integra à aba Security e à regra do ruleset.
- **Dependency review como job do `ci.yml`:** o `ci` passa quando um job é pulado, e o dependency review só faz sentido em PR. Um workflow próprio, com o check obrigatório pelo nome, deixa a falha visível e separa a permissão `pull-requests: write`, que só ele precisa. O required workflow da organização não serve: só existe em organização.
- **SHA à mão no `uses:`, com a versão em comentário:** era o pedido da issue e a recomendação antiga do guia de uso seguro do GitHub Actions. O guia, conferido em 2026-11-25, põe o lockfile como a proteção mais forte e diz que ele substitui o SHA, que fica para quem não pode adotá-lo. O SHA à mão não fixa as actions transitivas nem confere a identidade do repositório, e o diff de uma troca de SHA é ilegível.
- **Só a política "Require lockfile", sem o `sha_pinning_required` e o check:** a política não tem API, então nada a reproduz num repositório criado do template. O `sha_pinning_required` e o check `verify-lockfile` saem do `setup-github.mjs`, e o check acusa o lockfile desatualizado no próprio PR, antes do run quebrar.
- **`ignore` por pacote inteiro:** um `ignore` só pelo nome pararia de atualizar o pacote, inclusive a correção que destrava a exceção. O `ignore` segue a faixa da tabela de exceções: a versão quebrada do Nest, o TypeScript de 6.1 em diante e as majors de `keyv`, `@keyv/redis` e `ioredis`.
- **`npm audit --audit-level` no CI:** um advisory novo, alheio ao PR, deixaria o check obrigatório vermelho em qualquer PR até alguém atualizar a dependência. Os advisories ficam com os Dependabot alerts, os security updates e o dependency review, que olha só o que o PR muda. O `npm audit signatures` não depende de advisory: só falha com pacote sem assinatura válida.
- **`npm@latest` no CI antes do `audit signatures`:** a doc do npm recomenda o mais recente, mas instalar o `npm@latest` baixaria código sem versão fixa a cada run, o oposto do que o resto desta decisão protege. O CI usa o npm que vem com o Node do `.nvmrc`.

## Consequences

- Depois de adicionar ou mudar um `uses:`, é preciso rodar `gh actions-lock` e commitar o `actions.lock`. O `verify-lockfile` acusa quem esquecer.
- Uma linha nova, mudada ou removida na tabela de exceções muda o `ignore` do `.github/dependabot.yml` no mesmo PR.
- O PR do Dependabot de uma imagem muda só o `docker-compose.yml`. Quem o fecha completa as outras ocorrências na mesma branch.
- O Node (`.nvmrc`, o `ARG NODE_VERSION` do `Dockerfile` e o `engines`) continua conferido à mão.
- Um PR espera a análise do CodeQL, de uns minutos, antes do merge.
- Num repositório privado sem o GitHub Code Security, o ruleset fica sem a regra do CodeQL, e o `setup-github.mjs` avisa.
- O secret scanning e a push protection ficam para uma issue própria.
