---
type: reference
---

# Autenticação

As rotas de autenticação, o código de verificação, o access token, o refresh token, as rotas protegidas e os usuários de teste. O porquê do desenho está em [Autenticação e ownership](../explanation/autenticacao.md). Os passos estão em [Como proteger uma rota](../how-to/proteger-uma-rota.md).

## Rotas

Todas são `POST`, públicas e com rate limit próprio, por IP. O login também tem limite por conta. Um erro responde em Problem Details, com o `code` ([Respostas de erro](respostas-de-erro.md)). A validação do corpo responde 400 `VALIDATION_FAILED`.

| Rota | Corpo | Sucesso | Erros | Limite |
| --- | --- | --- | --- | --- |
| `/v1/auth/register` | `name` (1 a 100, sem contar os espaços das pontas), `email` (até 254), `password` (8 a 128) | 201 `{ id }` | 400 de validação, inclusive para um `name` vazio, só de espaços ou longo demais; 409 `EMAIL_ALREADY_IN_USE`; 422 `INVALID_EMAIL` | 10 por minuto |
| `/v1/auth/verify-email` | `email` (até 254), `code` (exatamente 6 dígitos) | 204 | 400 de validação; 400 `INVALID_VERIFICATION_CODE` | 10 por minuto |
| `/v1/auth/resend-verification-code` | `email` (até 254) | 202, sempre | 400 de validação | 5 por minuto |
| `/v1/auth/login` | `email`, `password` (até 128) | 200 `{ accessToken, expiresIn, refreshToken }` | 401 `INVALID_CREDENTIALS`; 403 `EMAIL_NOT_VERIFIED` | 5 por minuto por IP; por conta, 5 por minuto e 20 por hora |
| `/v1/auth/refresh` | `refreshToken` | 200 `{ accessToken, expiresIn, refreshToken }`, um par novo | 401 `INVALID_REFRESH_TOKEN` | 10 por minuto |
| `/v1/auth/logout` | `refreshToken` | 204, sempre | — | 10 por minuto |

- **Register:** o usuário nasce sem roles e com o e-mail por verificar. O register não abre sessão. Ele emite um código de verificação, que chega por e-mail ([Código de verificação](#código-de-verificação)).
- **Verify-email:** confere o código e marca o e-mail como verificado. Não abre sessão: depois dele, chame o login. Código errado, vencido, já usado ou esgotado e e-mail desconhecido dão o mesmo 400.
- **Resend-verification-code:** emite um código novo, que invalida o anterior, e o envia por e-mail. Responde 202 sempre, sem dizer se o e-mail saiu: e-mail desconhecido, conta já verificada, pedido antes de 60 segundos do último código e cota de códigos esgotada terminam em silêncio.
- **Login:** e-mail desconhecido e senha errada dão a mesma resposta, no mesmo tempo: os dois casos passam por uma verificação de hash. Com a senha certa e o e-mail por verificar, a resposta é 403 `EMAIL_NOT_VERIFIED`. Com a senha errada, a resposta é 401 `INVALID_CREDENTIALS`, com o e-mail verificado ou não. O limite por conta conta toda tentativa, certa ou errada, pelo e-mail normalizado (sem espaços nas pontas e em minúsculas). O contador vale para qualquer e-mail, cadastrado ou não, e o 429 sai igual nos dois casos. Um corpo sem e-mail válido não conta por conta, só por IP.
- **Refresh:** o token recebido deixa de valer. Use o `refreshToken` da resposta na próxima renovação. Token desconhecido, vencido, revogado ou reusado dão o mesmo 401.
- **Logout:** revoga a sessão inteira do refresh token (a família, ver abaixo). Responde 204 mesmo para um token desconhecido.

## Código de verificação

- 6 dígitos aleatórios (`crypto.randomInt`). O banco guarda só o hash SHA-256, na tabela `identity.email_verification_codes`.
- Vale `EMAIL_VERIFICATION_CODE_TTL_SECONDS`, 600 segundos (10 minutos) por padrão e no mínimo 60, contados da emissão.
- Uso único. Aceita até 5 tentativas erradas: a quinta esgota o código, e depois dela nem o código certo vale. Tentativas simultâneas contam uma a uma.
- Só o código mais recente do usuário vale: emitir um novo invalida os anteriores. Entre dois códigos, no mínimo 60 segundos, e no máximo 10 códigos por usuário em 24 horas, contando o do register.
- O e-mail do código leva só o código e a validade, sem o nome do cadastro.
- O código viaja em texto puro no evento `identity.verification-code-issued`, que o notifications usa para enviar o e-mail, e fica na outbox e nos jobs do Redis até a limpeza ([ADR 0009](../adr/0009-verificacao-de-email-com-codigo-no-evento.md)).

## Access token

- JWT HS256, assinado com `JWT_SECRET`. A verificação aceita só o HS256, seja qual for o algoritmo que o token declarar.
- Leva só o `sub` (id do usuário) e o `exp`. Não leva roles.
- Vale `JWT_ACCESS_TTL_SECONDS`, 900 segundos (15 minutos) por padrão. O `expiresIn` da resposta é esse valor em segundos, para o cliente saber quando renovar.
- Vai no cabeçalho `Authorization: Bearer <accessToken>`.
- Não pode ser revogado antes de vencer.

## Refresh token

- Opaco: 32 bytes aleatórios em base64url (43 caracteres). O banco guarda só o hash SHA-256.
- **Rotativo e de uso único.** Cada renovação troca o token por um sucessor, na mesma sessão (a família).
- **Reuso revoga a sessão inteira.** Se um token já trocado aparece de novo, a família inteira é revogada. Duas renovações concorrentes com o mesmo token contam como reuso.
- Cada token vale `REFRESH_TOKEN_TTL_SECONDS` (30 dias por padrão).
- A sessão tem um prazo absoluto, `REFRESH_FAMILY_MAX_AGE_SECONDS` (90 dias por padrão), contado do login. Renovar não o estende, e nenhum sucessor vence depois dele. Passado o prazo, só com a senha de novo.
- Um job apaga os refresh tokens vencidos uma vez por dia, às 3h (fila `jobs.identity`). Ele obedece ao `JOBS_ENABLED`.

## Rotas protegidas

- Toda rota exige o access token, a não ser que tenha `@Public()`. A autenticação é um guard global (`JwtAuthGuard`, em `src/shared/infra/auth/`).
- A cada requisição, o guard carrega o ator (id e roles) do banco, pelo port `ActorResolver`. Uma role removida ou uma conta apagada valem na requisição seguinte, e não quando o token vencer.
- `@Roles('admin')` restringe a rota a quem tem uma das roles listadas. O `RolesGuard` roda depois da autenticação.
- O controller recebe o ator com o decorator `@CurrentUser()`.

| Situação | Resposta |
| --- | --- |
| Sem token, token inválido ou vencido, sem `sub` ou sem `exp` | 401 |
| Token válido de um usuário que deixou de existir | 401 |
| Usuário sem nenhuma das roles exigidas | 403 |

## Usuários de teste

Os seeds (`npm run seed:identity`, ver [Comandos](comandos.md#seeds)) criam `admin@example.com`, com a role `admin`, e `user@example.com`, sem roles. Os dois usam a senha `Senha@12345` e nascem com o e-mail verificado, para entrar direto. Rodar o seed de novo verifica as duas contas, se um banco antigo as tiver por verificar.
