---
status: accepted
---

# Ator carregado a cada requisição

O token passa a levar só o `sub`. A cada requisição, o `JwtAuthGuard` monta o `Actor` (id e roles atuais) por meio do port `ActorResolver`. O port fica no `shared`, é implementado pelo `identity` e é ligado no `AppModule`. Assim, mudar uma role ou apagar um usuário vale na requisição seguinte, e não quando o token expirar. É o que a doc oficial do Nest recomenda: não pôr nas claims nada que possa mudar. O preço é uma leitura por PK em cada requisição, por enquanto sem cache.

O `shared` não importa o `identity`. Só o `AppModule`, que é a raiz de composição, conhece os dois.

## Considered Options

- **Roles no token com access token de 15 min:** o guard continua sem estado, mas uma mudança de role leva até 15 minutos para valer.
- **Roles no token com uma marca de revogação por usuário no Redis:** a mudança vale na hora, mas o Redis vira dependência da autenticação.
- **`@nestjs/authentication` e `@nestjs/authorization`:** seguem a doc oficial e já trazem refresh token rotativo, mas estão na 0.1.x (lançados em 2026-09). Ficam para quando chegarem à 1.0.

## Consequences

- O acesso continua com `@nestjs/jwt`, agora com access token de 15 minutos e refresh token opaco, rotativo e com detecção de reuso, guardado no schema `identity`.
- O `RolesGuard`, as regras de posse e os casos de uso não mudam, porque continuam consumindo o `Actor`.
