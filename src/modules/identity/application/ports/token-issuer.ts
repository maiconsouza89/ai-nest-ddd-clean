// Só o `sub`: roles mudam e são carregadas a cada requisição pelo ActorResolver (ADR 0002).
export type TokenClaims = { sub: string };

/** `expiresIn` em segundos, para o cliente saber quando renovar o token. */
export type IssuedAccessToken = { accessToken: string; expiresIn: number };

export abstract class TokenIssuer {
  abstract issue(claims: TokenClaims): Promise<IssuedAccessToken>;
}
