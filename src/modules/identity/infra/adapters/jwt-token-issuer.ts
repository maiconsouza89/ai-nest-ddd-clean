import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenClaims, TokenIssuer } from '../../application/ports/token-issuer';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  issue(claims: TokenClaims) {
    return this.jwt.signAsync({ ...claims });
  }
}
