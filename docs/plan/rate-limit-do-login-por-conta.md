# Plano do rate limit do login também por conta (#19)

A issue #19 pede um segundo limite no `POST /v1/auth/login`, chaveado pelo e-mail normalizado e somado ao limite por IP (5 por minuto). Assim, tentativas contra a mesma conta vindas de muitos IPs são barradas. Os limites devem crescer em degraus, sem bloqueio duro, para um atacante não travar com facilidade a conta de outra pessoa.

**Mudanças em relação ao texto da issue:**

- **O limite por conta não segura credential stuffing.** No stuffing, cada par vazado de e-mail e senha é tentado uma vez, em contas diferentes, e nenhum contador por conta passa de 1. O que o limite por conta barra é a adivinhação distribuída contra uma conta só (força bruta ou password spraying vindos de muitos IPs). É esse o cenário do "Contexto" da issue. A documentação diz isso com as palavras certas, e a defesa contra o stuffing (MFA, checagem de senha vazada) ganha uma linha em Evoluções com gatilho.
- **Só o login ganha limite por conta.** A issue cita o registro, a verificação e a renovação, mas:
  - a verificação e o reenvio já têm limite por conta no domínio: 5 tentativas por código, 10 códigos em 24 horas e 60 segundos entre códigos ([Autenticação](../reference/autenticacao.md#código-de-verificação));
  - o refresh token tem 256 bits de entropia e não se adivinha;
  - o registro não tem senha a adivinhar.
- **Não dá para pôr um throttler numa rota só.** No `@nestjs/throttler` 6.8.0, cada entrada do `forRoot` vale em toda rota com o guard, e o `@Throttle` só muda os campos de uma entrada que já existe. A documentação diz: "The definitions in `forRoot` are one policy, not a menu" (Context7, `/nestjs/throttler` v6.8.0, consultado em 2026-11-25). O limite por conta entra como opt-in: os throttlers de conta no `forRoot` se pulam (`skipIf`) em toda rota sem o decorator do `shared`.

Tudo entra em **um PR**, na branch `feat/rate-limit-por-conta`, o exemplo de nome do `.github/CONTRIBUTING.md`. O plano nasce e é apagado no mesmo PR. O registro fica num comentário da issue ([docs/README.md](../README.md#fora-dos-quadrantes)).

As decisões abaixo foram fechadas com o dono do repositório antes do plano. Mudar uma delas é decisão do dono, não de quem executa o passo.

| Assunto | Decisão |
| --- | --- |
| Mecanismo | Throttlers nomeados do `@nestjs/throttler`, com os contadores no `RedisThrottlerStorage` e o 429 do `ThrottlerGuard`. Fica descartado um port `LoginAttemptLimiter` no caso de uso, que contaria só as falhas e zeraria no sucesso: seria um segundo mecanismo de rate limit, com 429 e `Retry-After` próprios |
| O que conta | Toda tentativa de login, certa ou errada, como o limite por IP. O guard roda antes do caso de uso e não sabe o resultado |
| Limites por conta | Dois degraus. `account-minute`: 5 por minuto, com bloqueio de 1 minuto. `account-hour`: 20 por hora, com bloqueio de 1 hora (o `blockDuration` padrão é o `ttl`). O teto é de uns 480 palpites por dia por conta. O preço: com 21 tentativas numa hora, um atacante trava a conta da vítima por 1 hora |
| Limite por IP do login | Sem mudança: 5 por minuto no `default` |
| Chave | O e-mail normalizado pelo `Email.tryCreate` do identity (sem espaços nas pontas e em minúsculas), a mesma regra do `LoginUseCase`. O `generateKey` padrão do throttler passa a chave por SHA-256, e o e-mail não fica em texto puro no Redis |
| E-mail inválido ou ausente no corpo | Os throttlers de conta se pulam, e o `ValidationPipe` responde 400. O limite por IP continua valendo. Um balde comum para "inválido" travaria os pedidos malformados de todo mundo juntos |
| Enumeração de contas | O contador vale para qualquer e-mail, cadastrado ou não, e o 429 sai igual para os dois casos. Não revela se a conta existe |
| Opt-in no `shared` | Um decorator `@ThrottleByAccount(tracker)`, feito com `SetMetadata` e guardado em `src/shared/infra/http/`. O `tracker` recebe o `req` e devolve a chave ou `undefined`. O `shared` não conhece o e-mail: a função vem do identity. Nada de `applyDecorators`, pela regressão do TS1270 no Nest 12.6.1 com método que devolve valor ([Versões e exceções](../reference/versoes-e-excecoes.md)), e o `signIn` devolve valor |
| Onde ficam os números | Nas entradas `account-minute` e `account-hour` do `forRoot`, montadas por uma função do `shared` que o `AppModule` chama. Com uma rota só limitada por conta, limite por rota seria configuração sem uso. A linha em Evoluções com gatilho cobre a segunda rota |
| `skipIf` dos throttlers de conta | Confere também o `THROTTLE_ENABLED`. No guard, o `skipIf` da entrada substitui o comum (`namedThrottler.skipIf \|\| this.commonOptions.skipIf`), e sem a checagem os e2e com o throttle desligado passariam a contar por conta |
| `Retry-After` | Uma subclasse do `ThrottlerGuard` no `shared`, registrada no `APP_GUARD`, reescreve `Retry-After-<nome>` para `Retry-After`. O guard põe o sufixo do nome do throttler em todo header, e o 429 de conta sairia sem o `Retry-After` padrão, que o [Operação](../reference/operacao.md#rate-limit) promete. Os `X-RateLimit-*-account-minute` e `-account-hour` ficam com o sufixo e são documentados |
| Teste | Um e2e no `test/throttle.e2e-spec.ts`, com `TRUST_PROXY=1` e um `X-Forwarded-For` diferente por requisição. Unitários para o tracker do identity e para a subclasse do guard |
| Tipo do commit e do PR | `feat`: comportamento novo na API (429 por conta). Sem `!`: nenhum cliente que respeite os limites muda |

## Fora do plano

| Assunto | Destino |
| --- | --- |
| Credential stuffing (uma tentativa por conta, muitas contas) | Linha em Evoluções com gatilho: MFA ou checagem de senha vazada, como a Credential Stuffing Prevention Cheat Sheet da OWASP recomenda. Gatilho: o log mostrar muitos 401 de e-mails diferentes vindos de poucos IPs ou de faixas de proxy |
| Usuário legítimo travado por ataque à própria conta | Linha em Evoluções com gatilho: deixar passar o limite por conta quem já entrou daquele dispositivo (cookie ou token de dispositivo), ou liberar pela recuperação de senha, que o template não tem. Gatilho: um usuário reclamar de 429 no login com a senha certa |
| Uma segunda rota limitada por conta, com limites diferentes | Linha em Evoluções com gatilho: levar os números para o decorator (por rota) |
| Contar só as falhas e zerar no sucesso | Alternativa descartada, registrada no `docs/explanation/autenticacao.md` |
| Atraso exponencial de verdade (dobrar a espera a cada falha) | Alternativa descartada, registrada no mesmo lugar: pediria um script Lua próprio no `RedisThrottlerStorage`. Os dois degraus dão o atraso crescente que a issue pede |
| ADR | Não entra. A escolha cabe no `explanation/autenticacao.md` e não muda uma decisão registrada |

## Referências

- Issue #19: `gh issue view 19`.
- `@nestjs/throttler` 6.8.0 (instalado e latest em 2026-11-25), consultado no Context7 em 2026-11-25 (`/nestjs/throttler`, versão 6.8.0). As seções "Throttling specific routes", "Configure multiple named throttlers" e "Important note on using decorators with Named Throttlers" dizem que as entradas do `forRoot` valem em toda rota e que o `@SkipThrottle()` sem nomes só pula o `default`. O código do guard (`node_modules/@nestjs/throttler/dist/throttler.guard.js`) mostra três coisas: o `skipIf` da entrada substitui o comum, os headers ganham o sufixo `-<nome>` e o `getTracker` recebe `(req, context)`.
- OWASP, consultadas em 2026-11-25:
  - **[Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html).** O limite por IP não basta como defesa principal ("ease in circumvention"). Não se deve depender de um limite único e previsível: combine rajadas curtas e períodos longos, com bloqueios temporários. O MFA é "by far the best defense".
  - **[Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).** O contador de falhas fica na conta, e não no IP. Cuidado com o bloqueio usado para negar serviço a outras contas. A resposta é genérica, exista a conta ou não. As seções "Login Throttling" e "Account Lockout" foram lidas só por resumo: releia as duas no passo 2 antes de fechar os números.
- Código:
  - `src/app.module.ts` (`ThrottlerModule.forRootAsync` e `APP_GUARD`);
  - `src/shared/infra/http/redis-throttler-storage.ts`;
  - `src/modules/identity/infra/http/controllers/auth.controller.ts`;
  - `src/modules/identity/domain/value-objects/email.vo.ts`;
  - `src/modules/identity/application/use-cases/login.use-case.ts`;
  - `src/app.setup.ts` (`trust proxy`);
  - `test/throttle.e2e-spec.ts`.
- Páginas a mudar:
  - `docs/reference/autenticacao.md` (seção Rotas);
  - `docs/explanation/autenticacao.md`;
  - `docs/reference/operacao.md` (seção Rate limit);
  - `docs/reference/variaveis-de-ambiente.md` (linha do `THROTTLE_ENABLED`);
  - `docs/reference/evolucoes-com-gatilho.md`.
- Conflitos com outras trilhas, pelo [roadmap](roadmap-das-issues-abertas.md#arquivos-em-comum): nenhum no código. O `evolucoes-com-gatilho.md` também muda na #15 e na #16, uma linha cada. A ordem de merge põe a #19 depois da #13, da #16 e da #15: faça rebase sobre a `main` antes do PR.

## Como usar

- Execute os passos em ordem, um commit por passo, e marque o passo no mapa.
- Escreva as páginas de forma atemporal, com data só no registro da consulta ([docs/README.md](../README.md#como-escrever-uma-página)).
- Push, abertura de PR e comentário na issue só com o ok do dono do repositório.
- Legenda: ⬜ não iniciado, 🟡 em andamento, ✅ concluído.

## Mapa

| Passo | Entrega | Status |
| --- | --- | --- |
| 1 | Worktree, branch e roadmap | ✅ |
| 2 | Throttlers por conta e `Retry-After` no `shared` | ✅ |
| 3 | Limite por conta no login | ⬜ |
| 4 | E2E de IPs diferentes contra a mesma conta | ⬜ |
| 5 | Documentação | ⬜ |
| 6 | Verificação, revisão, registro e PR | ⬜ |

### Passo 1: worktree, branch e roadmap

1. Crie o worktree da trilha B com a branch `feat/rate-limit-por-conta` e rode `npm run worktree:setup` nele ([Como trabalhar com worktrees em paralelo](../how-to/trabalhar-com-worktrees-em-paralelo.md)).
2. Traga este plano para a branch.
3. No [roadmap](roadmap-das-issues-abertas.md#mapa), marque a #19 como 🟡.
4. Commit: `docs(plan): plano do rate limit do login por conta (#19)`. Confira o formato em `.github/CONTRIBUTING.md`.

### Passo 2: throttlers por conta no `shared`

Antes de codar, releia as seções "Login Throttling" e "Account Lockout" da Authentication Cheat Sheet. Se elas pedirem algo que contradiga a tabela de decisões, pare e leve ao dono.

1. `src/shared/infra/http/throttle-by-account.decorator.ts`:
   - `ThrottleByAccount(tracker: AccountTracker)`, com `SetMetadata` numa chave própria. `AccountTracker` é `(req: Record<string, unknown>) => string | undefined`.
   - Uma função `accountThrottlers(enabled: () => boolean)` que devolve as duas entradas do `forRoot`:
     - `account-minute`: `limit: 5`, `ttl: minutes(1)`;
     - `account-hour`: `limit: 20`, `ttl: hours(1)`.
   - As duas entradas usam o mesmo `skipIf` e o mesmo `getTracker`, que leem o tracker da rota pelo `Reflector`:
     - `skipIf` pula quando o throttle está desligado, quando a rota não tem o decorator ou quando o tracker devolve `undefined`;
     - `getTracker` devolve a chave do tracker.
   - Comente no código por que o `skipIf` repete o `THROTTLE_ENABLED`: o da entrada substitui o comum.
   - Se o nome do arquivo ou da função ficar estranho na leitura, ajuste. O que importa é o opt-in e a regra de não saber o que é a chave.
2. `src/shared/infra/http/throttler.guard.ts`: uma subclasse `@Injectable()` do `ThrottlerGuard` que sobrescreve o `setResponseHeader` para gravar `Retry-After-<nome>` como `Retry-After`. Os outros headers passam como estão. O nome da classe fica a critério de quem executa, por exemplo `AppThrottlerGuard`.
3. `src/app.module.ts`:
   - `throttlers: [{ ttl: seconds(60), limit: 100 }, ...accountThrottlers(() => config.get('THROTTLE_ENABLED', { infer: true }) !== 'false')]`;
   - o `APP_GUARD` passa à subclasse;
   - se o `skipIf` comum e o da conta passarem a ler o `THROTTLE_ENABLED` em dois lugares, extraia a leitura para uma função só.
4. Testes unitários ao lado dos arquivos:
   - `throttle-by-account.decorator.spec.ts`: o `skipIf` pula sem decorator, com o tracker devolvendo `undefined` e com o throttle desligado, e o `getTracker` devolve a chave. Monte o `ExecutionContext` com o helper que já existir em `test/helpers/` (`http-context.ts`) ou um fake mínimo.
   - `throttler.guard.spec.ts`: `Retry-After-account-minute` vira `Retry-After`, e `X-RateLimit-Limit-account-minute` não muda.
5. `npm run typecheck`, `npm run lint`, `npm run arch` e `npm test -- throttle`.
6. Commit: `feat(http): throttlers por conta com opt-in por rota e Retry-After sem sufixo (#19)`.

### Passo 3: limite por conta no login

1. `src/modules/identity/infra/http/login-account.tracker.ts`: `loginAccountTracker(req)` lê `req.body?.email`. Com uma string, devolve `Email.tryCreate(email)?.value`, e com outro tipo, `undefined`. O guard roda antes do `ValidationPipe`, então o corpo chega cru: não confie no tipo.
2. No `auth.controller.ts`, ponha `@ThrottleByAccount(loginAccountTracker)` no `signIn`, ao lado do `@Throttle` que já existe. As outras rotas ficam como estão.
3. `login-account.tracker.spec.ts`: `' User@Example.COM '` e `'user@example.com'` dão a mesma chave. Número, objeto, array, corpo ausente e e-mail inválido dão `undefined`.
4. `npm run typecheck`, `npm run lint`, `npm run arch` e `npm test -- login-account`.
5. Commit: `feat(identity): rate limit do login também por conta (#19)`.

### Passo 4: e2e

No `test/throttle.e2e-spec.ts`:

1. No `beforeAll`, ligue o `TRUST_PROXY=1` junto com o `THROTTLE_ENABLED`, antes do import do `AppModule`, e restaure os dois no `afterAll`. Cada requisição dos testes novos leva um `X-Forwarded-For` próprio (`10.0.0.<n>`), e o limite por IP não interfere.
2. Testes novos:
   - **IPs diferentes, mesma conta:** 6 logins com o mesmo e-mail, um IP por requisição, dão `[401, 401, 401, 401, 401, 429]`. O 429 sai em Problem Details com `code: 'TOO_MANY_REQUESTS'` e um `Retry-After` numérico.
   - **Normalização:** o e-mail com maiúsculas e espaços nas pontas conta no mesmo balde do minúsculo.
   - **Contas independentes:** com uma conta bloqueada, outro e-mail, de outro IP, ainda recebe 401.
   - **Degrau da hora:** quatro rodadas de 5 tentativas, com IPs diferentes. Entre as rodadas, apague só as chaves `throttle:{account-minute:*` do Redis (a contagem e o `:block`), para simular o minuto que passou. A 21ª tentativa dá 429 pelo `account-hour`.
3. O teste existente (`devolve 429 após vários logins seguidos`) continua com `[401 ×5, 429, 429]`: o IP e a conta estouram juntos. Se ele quebrar, entenda o motivo antes de mudar a expectativa.
4. O `clearThrottleKeys` já apaga `throttle:*` antes e depois do arquivo. Para isolar os testes novos entre si, chame-o também num `beforeEach`.
5. Encerre o `start:dev` deste checkout e rode `npm run test:e2e -- throttle`. Depois rode `npm run test:e2e` inteiro: os outros e2e rodam com o throttle desligado, e os throttlers de conta não podem contar nada neles.
6. Commit: `test(identity): e2e do rate limit do login por conta (#19)`.

### Passo 5: documentação

1. `docs/reference/autenticacao.md`, seção Rotas:
   - a frase "rate limit próprio, por IP" diz que o login também tem limite por conta;
   - na coluna Limite do login: "5 por minuto por IP; por conta, 5 por minuto e 20 por hora";
   - no bullet do login: o contador vale para qualquer e-mail, cadastrado ou não, e o 429 não revela se a conta existe.
2. `docs/explanation/autenticacao.md`, seção nova "O login também é limitado por conta", com:
   - o cenário (adivinhação distribuída contra uma conta) e o que fica de fora (credential stuffing, com o link para Evoluções com gatilho);
   - os dois degraus como atraso crescente e o preço deles: 21 tentativas numa hora travam a conta da vítima por 1 hora;
   - por que tudo conta, e não só as falhas;
   - a chave com hash no Redis e o 429 igual para conta existente ou não.

   Em "Alternativas e trade-offs", acrescente o port no caso de uso, que conta só as falhas, e o atraso exponencial. No bullet do código de verificação, "O rate limit da rota é por IP" continua certo para a verificação: confira que o texto não ficou ambíguo com o limite por conta do login.
3. `docs/reference/operacao.md`, seção Rate limit:
   - uma linha "Limites por conta": opt-in com `@ThrottleByAccount`, as entradas `account-minute` e `account-hour` e o `skipIf` que as pula fora das rotas marcadas;
   - na linha "Resposta bloqueada", o `Retry-After` sem sufixo para todo throttler;
   - na linha "Headers", os headers com sufixo de cada throttler nomeado.
4. `docs/reference/variaveis-de-ambiente.md`: a descrição do `THROTTLE_ENABLED` cita o limite por conta do login.
5. `docs/reference/evolucoes-com-gatilho.md`, tabela "Código e dependências": as três linhas de [Fora do plano](#fora-do-plano), que são credential stuffing, usuário legítimo travado e segunda rota por conta, com o contexto apontando para [Autenticação e ownership](../explanation/autenticacao.md).
6. `npm run docs:check`.
7. Commit: `docs(identity): rate limit do login por conta (#19)`.

### Passo 6: verificação, revisão, registro e PR

1. `npm run ci`. A mudança toca HTTP e Redis: rode também `npm run test:int` e `npm run test:e2e`.
2. Rode a skill `/simplify` sobre as mudanças e depois a `/code-review` (fluxo de entrega do `AGENTS.md`). Se alguma mudar código, repita o passo 1.
3. Faça rebase sobre a `main` e rode `npm run ci` de novo.
4. Com o ok do dono, faça push e abra o PR com o título `feat(identity): rate limit do login também por conta (#19)`. A descrição traz:
   - as três mudanças em relação à issue: o stuffing fora do alcance, só o login e o opt-in;
   - os limites e o preço do bloqueio;
   - o `Retry-After` sem sufixo;
   - os headers novos.
5. Com o ok do dono, deixe na issue um comentário de registro com este plano e os mesmos pontos da descrição.
6. Último commit da branch, `docs(plan): fecha o plano do rate limit do login por conta (#19)`:
   - apague este plano;
   - no roadmap, marque a #19 como ✅, com o número do PR na linha;
   - na seção "Fora dos quadrantes" do `docs/README.md`, acrescente o link do comentário da #19, como os das issues #35 e #18;
   - rode `npm run docs:check` de novo e faça push.
