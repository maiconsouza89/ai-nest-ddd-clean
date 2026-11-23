import { TokenClaims, TokenIssuer } from '#modules/identity/application/ports/token-issuer';

export class FakeTokenIssuer implements TokenIssuer {
  readonly issued: TokenClaims[] = [];

  constructor(readonly expiresIn = 60) {}

  async issue(claims: TokenClaims) {
    this.issued.push(claims);
    return { accessToken: `token-for-${claims.sub}`, expiresIn: this.expiresIn };
  }
}
