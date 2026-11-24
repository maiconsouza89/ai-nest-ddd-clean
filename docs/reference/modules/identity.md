---
type: reference
---

# Módulo identity

Contas de usuário, verificação do e-mail, login e sessões, e o ator de cada requisição.

Código em `src/modules/identity/`, registrado no `src/app.module.ts` em dois módulos Nest:

| Módulo | Fornece | Quem importa |
| --- | --- | --- |
| `IdentityModule` | Rotas de autenticação, casos de uso, job de limpeza, eventos publicados. Exporta só a `UserDirectoryFacade` | `AppModule` e [notifications](notifications.md) |
| `IdentityAuthModule` | O `ActorResolver` do shared, implementado pelo `TypeOrmActorResolver` | Só o `AppModule`, que o entrega ao `AuthModule.forRoot` |

Rotas, tokens e prazos estão em [Autenticação](../autenticacao.md). Esta página não os repete.

## Linguagem ubíqua

| Termo | No código | Significado |
| --- | --- | --- |
| Usuário | `User` | A conta: e-mail, nome, hash da senha e roles. Ver [Usuário, ator e cliente](../glossario.md#usuário-ator-e-cliente). |
| E-mail | `Email` | Value object. Gravado sem espaços nas pontas e em minúsculas, com até 254 caracteres. Único entre os usuários. |
| Role | `roles` | Permissão da conta, como `admin`. Um usuário cadastrado pelo register nasce sem roles. |
| Registrar | `User.register`, `RegisterUserUseCase` | Criar a conta, com o e-mail por verificar, e emitir o primeiro código de verificação. Não abre sessão. |
| Verificar o e-mail | `User.verifyEmail`, `VerifyEmailUseCase`, `emailVerifiedAt` | Provar, com o código de verificação, que a pessoa recebe os e-mails do endereço da conta. Libera o login. Não abre sessão. "Confirmar" é termo do orders e do notifications, não daqui. |
| Código de verificação | `VerificationCode`, `VerificationCodeIssuer` | Seis dígitos enviados por e-mail, de uso único, com prazo e no máximo 5 tentativas erradas. Só o mais recente do usuário vale. O banco guarda o hash. |
| Reenviar o código | `ResendVerificationCodeUseCase` | Emitir um código novo, que invalida o anterior, no mínimo 60 segundos depois do último e dentro da cota de 10 códigos por usuário em 24 horas (`CODE_QUOTA`). |
| Sessão | família de refresh tokens (`familyId`) | Nasce no login e termina no logout, no reuso de um token, no prazo absoluto, quando o token vence pelo próprio TTL (`REFRESH_TOKEN_TTL_SECONDS`) sem ser renovado (`isDeadAt` em `refresh-token.entity.ts`) ou quando o usuário é apagado (`ON DELETE CASCADE` em `refresh_tokens`, na `refresh-token.orm-entity.ts`). |
| Refresh token | `RefreshToken` | Token opaco, de uso único, trocado por um sucessor a cada renovação. O banco guarda só o hash. |
| Access token | `TokenIssuer` (`JwtTokenIssuer`) | JWT de vida curta, com o `sub` do usuário e sem roles. |
| Ator | `Actor` (shared), `TypeOrmActorResolver` | Quem faz a requisição: id e roles lidos do banco a cada requisição. O identity o fornece, mas o tipo é do shared. |

## Contrato público

**Facade:** `UserDirectoryFacade`, em `src/modules/identity/contracts/user-directory.facade.ts`.

| Método | Devolve |
| --- | --- |
| `emailOf(userId: string)` | O e-mail do usuário, ou `null` se o id não existir ou não for um uuid |

**Port do shared:** `ActorResolver.resolve(userId)` devolve `{ id, roles }`, ou `null` para um usuário que não existe. Só o guard de autenticação o usa.

**HTTP:** `POST /v1/auth/register`, `/verify-email`, `/resend-verification-code`, `/login`, `/refresh` e `/logout`. Corpos, respostas, erros e limites em [Autenticação](../autenticacao.md#rotas).

## Eventos publicados

Contratos em `src/modules/identity/contracts/events/`, com um exemplo versionado de cada um (`*.v1.example.ts`). O teste de contrato do publicador é o `application/events/to-integration-event.contract.spec.ts`.

| Evento | Quando | Payload | Consumido por |
| --- | --- | --- | --- |
| `identity.verification-code-issued` v1 | No register e em cada reenvio aceito | `userId`, `email`, `name`, `code`, `expiresAt` | [notifications](notifications.md#eventos-consumidos) (`notifications.email-on-verification-code-issued`) |
| `identity.email-verified` v1 | Na verificação do e-mail | `userId`, `email`, `name` | [notifications](notifications.md#eventos-consumidos) (`notifications.email-on-email-verified`) |

- Os dois são gravados na outbox na mesma transação do usuário e do código, com o id do usuário como `aggregateId`.
- O `code` viaja **em texto puro**: é o que o notifications envia. Ele fica na `shared.outbox` até a limpeza dos eventos publicados (7 dias) e, numa linha morta, até alguém apagá-la, e nos jobs do BullMQ, no Redis, por até 7 dias. O motivo e as alternativas estão na [ADR 0009](../../adr/0009-verificacao-de-email-com-codigo-no-evento.md).
- O `identity.email-verified` sai de um evento de domínio (`EmailVerified`, anotado pelo `User.verifyEmail`). O `identity.verification-code-issued`, não: a entidade só conhece o hash, então o `VerificationCodeIssuer` monta o contrato com o código que acabou de gerar.

## Eventos consumidos

Nenhum.

## Invariantes

| Regra | Erro |
| --- | --- |
| O e-mail tem formato válido e até 254 caracteres | `INVALID_EMAIL` |
| O nome tem de 1 a 100 caracteres, sem contar os espaços nas pontas. Pelo HTTP, o DTO barra antes, com 400 de validação | `INVALID_NAME` |
| O e-mail é único. O caso de uso confere antes, e o `UNIQUE` do banco resolve a corrida | `EMAIL_ALREADY_IN_USE` |
| O register não concede roles | — |
| E-mail desconhecido e senha errada dão o mesmo erro | `INVALID_CREDENTIALS` |
| A conta nasce com o e-mail por verificar, e o login com a senha certa é recusado até a verificação. A senha errada continua dando `INVALID_CREDENTIALS` | `EMAIL_NOT_VERIFIED` |
| O código vale `EMAIL_VERIFICATION_CODE_TTL_SECONDS` desde a emissão, uma vez só, e aceita até 5 tentativas erradas. Tentativas simultâneas contam uma a uma (trava na linha do código) | `INVALID_VERIFICATION_CODE` |
| Só o código mais recente vale: emitir um novo marca os anteriores como usados | `INVALID_VERIFICATION_CODE` |
| Código errado, vencido, usado, esgotado e e-mail desconhecido dão o mesmo erro | `INVALID_VERIFICATION_CODE` |
| Verificar de novo não muda a data nem publica o evento outra vez | — |
| Entre dois códigos do mesmo usuário, no mínimo 60 segundos, e no máximo 10 em 24 horas, contando o do register. O reenvio fora disso, para e-mail desconhecido ou para conta verificada termina sem erro e sem e-mail | — |
| Um refresh token renova uma vez só. O reuso revoga a família inteira | `INVALID_REFRESH_TOKEN` |
| Nenhum refresh token vence depois do prazo absoluto da família | — |

## Job

Scheduler `identity.purge-expired-refresh-tokens`, que apaga os refresh tokens vencidos. Fila, horário e chave de liga e desliga em [Refresh token](../autenticacao.md#refresh-token).

## Dependências

Nenhum módulo de negócio. Importa o `MessagingModule` do shared, para o job, e grava na `Outbox` do shared.

| Port | Adapter |
| --- | --- |
| `PasswordHasher` | `Argon2PasswordHasher` |
| `TokenIssuer` | `JwtTokenIssuer`, com `JWT_ACCESS_TTL_SECONDS` |
| `OpaqueTokenGenerator` | `CryptoOpaqueTokenGenerator` |
| `VerificationCodeGenerator` | `CryptoVerificationCodeGenerator`: 6 dígitos por `crypto.randomInt` e hash SHA-256 |
| `VerificationCodeRepository` | `TypeOrmVerificationCodeRepository` |

O prazo do código vem de `EMAIL_VERIFICATION_CODE_TTL_SECONDS` ([Variáveis de ambiente](../variaveis-de-ambiente.md#autenticação)).

## Schema e migrations

- Schema `identity`, migrations registradas em `identity_migrations`. Aplique com `npm run mig:identity:run`.
- Migrations em `src/modules/identity/infra/database/typeorm/migrations/`.
- A migration do e-mail verificado não preenche contas antigas: o template começa de um banco vazio. Num banco com contas, elas ficam por verificar e precisam pedir um código pelo reenvio.

| Tabela | Conteúdo |
| --- | --- |
| `users` | `id`, `email` (único, até 254), `name` (até 100), `passwordHash`, `roles` (`text[]`, padrão vazio), `emailVerifiedAt` (nula até a verificação), `createdAt` |
| `email_verification_codes` | `id`, `userId`, `codeHash` (SHA-256), `expiresAt`, `attempts` (padrão 0), `usedAt`, `createdAt`. Índice em `userId`. Apagada em cascata com o usuário. Como no `refresh_tokens`, as props da entidade são as colunas, sem mapper |
| `refresh_tokens` | `id`, `familyId`, `userId`, `tokenHash` (SHA-256, único), `createdAt`, `expiresAt`, `familyExpiresAt`, `usedAt`, `revokedAt`. Índices em `expiresAt`, `userId` e `familyId`. Apagada em cascata com o usuário |

**Seed** (`npm run seed:identity`): os [usuários de teste](../autenticacao.md#usuários-de-teste), já com o e-mail verificado. Insere só quem falta, sem trocar id, roles nem senha de conta existente. Numa conta de teste que já existia sem verificação, preenche só o `emailVerifiedAt`.

## Decisões

- [ADR 0002](../../adr/0002-ator-carregado-por-requisicao.md): o token identifica o usuário, e o ator é carregado a cada requisição.
- [ADR 0003](../../adr/0003-imports-explicitos-entre-modulos.md): o `IdentityModule` exporta só a facade, e o `ActorResolver` fica num módulo à parte.
- [ADR 0009](../../adr/0009-verificacao-de-email-com-codigo-no-evento.md): o login espera a verificação do e-mail, e o código viaja em texto puro no evento.
