// Só o `sub`: roles mudam e são carregadas a cada requisição pelo ActorResolver (ADR 0002).
export type TokenClaims = { sub: string };

export abstract class TokenIssuer {
  abstract issue(claims: TokenClaims): Promise<string>;
}
