export type RefreshTokenProps = {
  id: string;
  familyId: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  familyExpiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

/** Prazos da sessão, em ms. */
export type RefreshTokenPolicy = {
  /** Validade de cada token. */
  ttlMs: number;
  /** Prazo absoluto da família, contado do login: renovar não o estende. */
  familyMaxAgeMs: number;
};

type NewToken = { id: string; tokenHash: string };

/**
 * Um refresh token de uma família. A família nasce no login, e cada renovação troca o token por
 * um sucessor. Cada token só pode ser usado uma vez: `wasUsed` pega o reuso comum, e o `markUsed`
 * atômico do repositório pega a corrida, em que duas renovações leem o token ainda sem uso.
 */
export class RefreshToken {
  private constructor(private readonly props: RefreshTokenProps) {}

  static startFamily(
    token: NewToken & { familyId: string; userId: string },
    now: Date,
    policy: RefreshTokenPolicy,
  ) {
    const familyExpiresAt = new Date(now.getTime() + policy.familyMaxAgeMs);
    return RefreshToken.issue({ ...token, familyExpiresAt }, now, policy.ttlMs);
  }

  static restore(props: RefreshTokenProps) {
    return new RefreshToken({ ...props });
  }

  /** O sucessor na mesma família, que nunca vence depois do prazo absoluto dela. */
  rotate(token: NewToken, now: Date, policy: RefreshTokenPolicy) {
    const { familyId, userId, familyExpiresAt } = this.props;
    return RefreshToken.issue({ ...token, familyId, userId, familyExpiresAt }, now, policy.ttlMs);
  }

  /** Cópia do estado, para a persistência gravar. */
  toProps(): RefreshTokenProps {
    return { ...this.props };
  }

  /** Já foi trocado por um sucessor: aparecer de novo é reuso. */
  get wasUsed() {
    return this.props.usedAt !== null;
  }

  /** Revogado (logout ou reuso) ou vencido: não serve mais para renovar. */
  isDeadAt(now: Date) {
    return this.props.revokedAt !== null || now >= this.props.expiresAt;
  }

  private static issue(
    token: NewToken & { familyId: string; userId: string; familyExpiresAt: Date },
    now: Date,
    ttlMs: number,
  ) {
    const expiresAt = new Date(Math.min(now.getTime() + ttlMs, token.familyExpiresAt.getTime()));
    return new RefreshToken({
      ...token,
      createdAt: now,
      expiresAt,
      usedAt: null,
      revokedAt: null,
    });
  }

  get id() {
    return this.props.id;
  }
  get familyId() {
    return this.props.familyId;
  }
  get userId() {
    return this.props.userId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get expiresAt() {
    return this.props.expiresAt;
  }
  get familyExpiresAt() {
    return this.props.familyExpiresAt;
  }
  get usedAt() {
    return this.props.usedAt;
  }
  get revokedAt() {
    return this.props.revokedAt;
  }
}
