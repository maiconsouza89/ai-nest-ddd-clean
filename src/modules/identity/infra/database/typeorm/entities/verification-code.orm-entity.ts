import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserOrmEntity } from './user.orm-entity.js';

@Entity({ name: 'email_verification_codes', schema: 'identity' })
@Index('IDX_identity_email_verification_codes_userId', ['userId'])
export class VerificationCodeOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  // conta apagada leva junto os códigos dela
  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserOrmEntity;

  // SHA-256 em hex: o código nunca é gravado
  @Column('char', { length: 64 })
  codeHash!: string;

  @Column('timestamptz')
  expiresAt!: Date;

  @Column('int', { default: 0 })
  attempts!: number;

  @Column('timestamptz', { nullable: true })
  usedAt!: Date | null;

  @Column('timestamptz')
  createdAt!: Date;
}
