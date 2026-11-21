export type TokenClaims = { sub: string; roles: string[]; tenantId?: string };

export abstract class TokenIssuer {
  abstract issue(claims: TokenClaims): Promise<string>;
}
