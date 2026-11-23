import { JwtService } from '@nestjs/jwt';
import {
  IssuedAccessToken,
  TokenClaims,
  TokenIssuer,
} from '../../application/ports/token-issuer.js';

export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    private readonly ttlSeconds: number,
  ) {}

  async issue(claims: TokenClaims): Promise<IssuedAccessToken> {
    const accessToken = await this.jwt.signAsync({ ...claims }, { expiresIn: this.ttlSeconds });
    return { accessToken, expiresIn: this.ttlSeconds };
  }
}
