import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerification1795545972474 implements MigrationInterface {
    name = 'AddEmailVerification1795545972474'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "identity"."email_verification_codes" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "codeHash" character(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_5bb1cbeebcbcb38996911bff8d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_identity_email_verification_codes_userId" ON "identity"."email_verification_codes"  ("userId") `);
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "emailVerifiedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "identity"."email_verification_codes" ADD CONSTRAINT "FK_97bef998b0d463cb053643822a3" FOREIGN KEY ("userId") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."email_verification_codes" DROP CONSTRAINT "FK_97bef998b0d463cb053643822a3"`);
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "emailVerifiedAt"`);
        await queryRunner.query(`DROP INDEX "identity"."IDX_identity_email_verification_codes_userId"`);
        await queryRunner.query(`DROP TABLE "identity"."email_verification_codes"`);
    }

}
