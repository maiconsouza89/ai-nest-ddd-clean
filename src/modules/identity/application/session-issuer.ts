import { Clock } from '#shared/application/ports/clock';
import { IdGenerator } from '#shared/application/ports/id-generator';
import { RefreshToken, RefreshTokenPolicy } from '../domain/entities/refresh-token.entity.js';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token.repository.js';
import { OpaqueTokenGenerator } from './ports/opaque-token-generator.js';
import { IssuedAccessToken, TokenIssuer } from './ports/token-issuer.js';

export type Session = IssuedAccessToken & { refreshToken: string };

/** Emite o par de tokens da sessão: o access token e o refresh token, gravado como hash. */
export class SessionIssuer {
  constructor(
    private readonly accessTokens: TokenIssuer,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly secrets: OpaqueTokenGenerator,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly policy: RefreshTokenPolicy,
  ) {}

  /** Login: abre uma família nova. */
  start(userId: string) {
    return this.issue((token, now) =>
      RefreshToken.startFamily({ ...token, familyId: this.ids.next(), userId }, now, this.policy),
    );
  }

  /** Renovação: o sucessor de um token que o chamador já marcou como usado. */
  rotate(previous: RefreshToken) {
    return this.issue((token, now) => previous.rotate(token, now, this.policy));
  }

  private async issue(
    create: (token: { id: string; tokenHash: string }, now: Date) => RefreshToken,
  ): Promise<Session> {
    const refreshToken = this.secrets.generate();
    const next = create(
      { id: this.ids.next(), tokenHash: this.secrets.hash(refreshToken) },
      this.clock.now(),
    );
    await this.refreshTokens.add(next);
    // o access token só leva o `sub`: as roles vêm do banco a cada requisição (ADR 0002)
    const access = await this.accessTokens.issue({ sub: next.userId });
    return { ...access, refreshToken };
  }
}
