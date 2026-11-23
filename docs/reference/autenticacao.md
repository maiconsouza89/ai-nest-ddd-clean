---
type: reference
---

# Autenticação

O porquê do desenho está em [Autenticação e ownership](../explanation/autenticacao.md): o token só identifica o usuário, o ator é carregado a cada requisição ([ADR 0002](../adr/0002-ator-carregado-por-requisicao.md)), a sessão vive num refresh token rotativo e o ownership fica no caso de uso.

## Rotas

Todas são `POST`, públicas e com rate limit próprio, por IP. Um erro de domínio responde `{ code, message }`.

| Rota | Corpo | Sucesso | Erros | Limite |
| --- | --- | --- | --- | --- |
| `/v1/auth/register` | `name` (até 100), `email` (até 254), `password` (8 a 128) | 201 `{ id }` | 409 `EMAIL_ALREADY_IN_USE`, 422 `INVALID_EMAIL` ou `INVALID_NAME` | 10 por minuto |
| `/v1/auth/login` | `email`, `password` (até 128) | 200 `{ accessToken, expiresIn, refreshToken }` | 401 `INVALID_CREDENTIALS` | 5 por minuto |
| `/v1/auth/refresh` | `refreshToken` | 200 `{ accessToken, expiresIn, refreshToken }`, um par novo | 401 `INVALID_REFRESH_TOKEN` | 10 por minuto |
| `/v1/auth/logout` | `refreshToken` | 204, sempre | — | 10 por minuto |

- **Register:** o usuário nasce sem roles. O register não abre sessão: depois dele, chame o login.
- **Login:** e-mail desconhecido e senha errada dão a mesma resposta. Os dois casos pagam uma verificação de hash, então o tempo de resposta também não revela quais e-mails estão cadastrados.
- **Refresh:** o token recebido deixa de valer. Use o `refreshToken` da resposta na próxima renovação. Token desconhecido, vencido, revogado ou reusado dão o mesmo 401.
- **Logout:** revoga a sessão inteira do refresh token (a família, ver abaixo). Responde 204 mesmo para um token desconhecido, para não revelar quais tokens existem.

## Access token

- JWT HS256, assinado com `JWT_SECRET`. A verificação aceita só o HS256, seja qual for o algoritmo que o token declarar.
- Leva só o `sub` (id do usuário) e o `exp`. Não leva roles.
- Vale `JWT_ACCESS_TTL_SECONDS`, 900 segundos (15 minutos) por padrão. O `expiresIn` da resposta é esse valor em segundos, para o cliente saber quando renovar.
- Vai no cabeçalho `Authorization: Bearer <accessToken>`.
- Não pode ser revogado antes de vencer. Por isso a validade é curta.

## Refresh token

- Opaco: 32 bytes aleatórios em base64url (43 caracteres). O banco guarda só o hash SHA-256.
- **Rotativo e de uso único.** Cada renovação troca o token por um sucessor, na mesma sessão (a família).
- **Reuso revoga a sessão inteira.** Se um token já trocado aparece de novo, duas partes têm o mesmo token (o cliente e quem o roubou), e a família inteira é revogada. Duas renovações concorrentes com o mesmo token contam como reuso.
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

Os seeds (`npm run seed:identity`, ver [Comandos](comandos.md#seeds)) criam `admin@example.com`, com a role `admin`, e `user@example.com`, sem roles. Os dois usam a senha `Senha@12345`.
