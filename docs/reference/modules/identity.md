---
type: reference
---

# Módulo identity

Contas de usuário, login e sessões, e o ator de cada requisição.

Código em `src/modules/identity/`, registrado no `src/app.module.ts` em dois módulos Nest:

| Módulo | Fornece | Quem importa |
| --- | --- | --- |
| `IdentityModule` | Rotas de autenticação, casos de uso, job de limpeza. Exporta só a `UserDirectoryFacade` | `AppModule` e [notifications](notifications.md) |
| `IdentityAuthModule` | O `ActorResolver` do shared, implementado pelo `TypeOrmActorResolver` | Só o `AppModule`, que o entrega ao `AuthModule.forRoot` |

Rotas, tokens e prazos estão em [Autenticação](../autenticacao.md). Esta página não os repete.

## Linguagem ubíqua

| Termo | No código | Significado |
| --- | --- | --- |
| Usuário | `User` | A conta: e-mail, nome, hash da senha e roles. Ver [Usuário, ator e cliente](../glossario.md#usuário-ator-e-cliente). |
| E-mail | `Email` | Value object. Gravado sem espaços nas pontas e em minúsculas, com até 254 caracteres. Único entre os usuários. |
| Role | `roles` | Permissão da conta, como `admin`. Um usuário cadastrado pelo register nasce sem roles. |
| Registrar | `User.register`, `RegisterUserUseCase` | Criar a conta. Não abre sessão. |
| Sessão | família de refresh tokens (`familyId`) | Nasce no login e termina no logout, no reuso de um token ou no prazo absoluto. |
| Refresh token | `RefreshToken` | Token opaco, de uso único, trocado por um sucessor a cada renovação. O banco guarda só o hash. |
| Access token | `TokenIssuer` (`JwtTokenIssuer`) | JWT de vida curta, com o `sub` do usuário e sem roles. |
| Ator | `Actor` (shared), `TypeOrmActorResolver` | Quem faz a requisição: id e roles lidos do banco a cada requisição. O identity o fornece, mas o tipo é do shared. |

## Contrato público

**Facade:** `UserDirectoryFacade`, em `src/modules/identity/contracts/user-directory.facade.ts`.

| Método | Devolve |
| --- | --- |
| `emailOf(userId: string)` | O e-mail do usuário, ou `null` se o id não existir ou não for um uuid |

**Port do shared:** `ActorResolver.resolve(userId)` devolve `{ id, roles }`, ou `null` para um usuário que não existe. Só o guard de autenticação o usa.

**HTTP:** `POST /v1/auth/register`, `/login`, `/refresh` e `/logout`. Corpos, respostas, erros e limites em [Autenticação](../autenticacao.md#rotas).

## Eventos publicados

Nenhum.

## Eventos consumidos

Nenhum.

## Invariantes

| Regra | Erro |
| --- | --- |
| O e-mail tem formato válido e até 254 caracteres | `INVALID_EMAIL` |
| O nome tem de 1 a 100 caracteres, sem contar os espaços nas pontas | `INVALID_NAME` |
| O e-mail é único. O caso de uso confere antes, e o `UNIQUE` do banco resolve a corrida | `EMAIL_ALREADY_IN_USE` |
| O register não concede roles | — |
| E-mail desconhecido e senha errada dão o mesmo erro | `INVALID_CREDENTIALS` |
| Um refresh token renova uma vez só. O reuso revoga a família inteira | `INVALID_REFRESH_TOKEN` |
| Nenhum refresh token vence depois do prazo absoluto da família | — |

## Job

Scheduler `identity.purge-expired-refresh-tokens`, que apaga os refresh tokens vencidos. Fila, horário e chave de liga e desliga em [Refresh token](../autenticacao.md#refresh-token).

## Dependências

Nenhum módulo de negócio. Importa o `MessagingModule` do shared, para o job.

| Port | Adapter |
| --- | --- |
| `PasswordHasher` | `Argon2PasswordHasher` |
| `TokenIssuer` | `JwtTokenIssuer`, com `JWT_ACCESS_TTL_SECONDS` |
| `OpaqueTokenGenerator` | `CryptoOpaqueTokenGenerator` |

## Schema e migrations

- Schema `identity`, migrations registradas em `identity_migrations`. Aplique com `npm run mig:identity:run`.
- Migrations em `src/modules/identity/infra/database/typeorm/migrations/`.

| Tabela | Conteúdo |
| --- | --- |
| `users` | `id`, `email` (único, até 254), `name` (até 100), `passwordHash`, `roles` (`text[]`, padrão vazio), `createdAt` |
| `refresh_tokens` | `id`, `familyId`, `userId`, `tokenHash` (SHA-256, único), `createdAt`, `expiresAt`, `familyExpiresAt`, `usedAt`, `revokedAt`. Índices em `expiresAt`, `userId` e `familyId`. Apagada em cascata com o usuário |

**Seed** (`npm run seed:identity`): os [usuários de teste](../autenticacao.md#usuários-de-teste). Insere só quem falta, sem trocar id, roles nem senha de conta existente.

## Decisões

- [ADR 0002](../../adr/0002-ator-carregado-por-requisicao.md): o token identifica o usuário, e o ator é carregado a cada requisição.
- [ADR 0003](../../adr/0003-imports-explicitos-entre-modulos.md): o `IdentityModule` exporta só a facade, e o `ActorResolver` fica num módulo à parte.
