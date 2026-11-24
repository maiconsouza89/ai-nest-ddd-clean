import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'users', schema: 'identity' })
@Unique('UQ_identity_users_email', ['email']) // 2º nível da unicidade do e-mail
export class UserOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 254 })
  email!: string;

  @Column('varchar', { length: 100 })
  name!: string;

  @Column('varchar')
  passwordHash!: string;

  @Column('text', { array: true, default: () => "'{}'" })
  roles!: string[];

  // nulo até a verificação do e-mail: o login fica recusado enquanto isso
  @Column('timestamptz', { nullable: true })
  emailVerifiedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
