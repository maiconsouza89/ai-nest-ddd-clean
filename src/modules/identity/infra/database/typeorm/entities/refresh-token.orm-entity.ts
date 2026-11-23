import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { UserOrmEntity } from './user.orm-entity.js';

@Entity({ name: 'refresh_tokens', schema: 'identity' })
@Unique('UQ_identity_refresh_tokens_tokenHash', ['tokenHash'])
@Index('IDX_identity_refresh_tokens_familyId', ['familyId'])
@Index('IDX_identity_refresh_tokens_userId', ['userId'])
// a limpeza apaga os tokens vencidos
@Index('IDX_identity_refresh_tokens_expiresAt', ['expiresAt'])
export class RefreshTokenOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  familyId!: string;

  @Column('uuid')
  userId!: string;

  // conta apagada leva junto as sessões dela, e a renovação seguinte recebe 401
  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserOrmEntity;

  // SHA-256 em hex: o valor do token nunca é gravado
  @Column('char', { length: 64 })
  tokenHash!: string;

  @Column('timestamptz')
  createdAt!: Date;

  @Column('timestamptz')
  expiresAt!: Date;

  @Column('timestamptz')
  familyExpiresAt!: Date;

  @Column('timestamptz', { nullable: true })
  usedAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  revokedAt!: Date | null;
}
