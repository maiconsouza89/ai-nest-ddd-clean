import {
  TokenClaims,
  TokenIssuer,
} from '../../src/modules/identity/application/ports/token-issuer';

export class FakeTokenIssuer implements TokenIssuer {
  readonly issued: TokenClaims[] = [];

  async issue(claims: TokenClaims) {
    this.issued.push(claims);
    return `token-for-${claims.sub}`;
  }
}
