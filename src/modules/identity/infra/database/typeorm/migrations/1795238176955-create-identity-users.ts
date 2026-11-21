import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIdentityUsers1795238176955 implements MigrationInterface {
    name = 'CreateIdentityUsers1795238176955'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "identity"."users" ("id" uuid NOT NULL, "email" character varying(254) NOT NULL, "passwordHash" character varying NOT NULL, "roles" text array NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_identity_users_email" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "identity"."users"`);
    }

}
