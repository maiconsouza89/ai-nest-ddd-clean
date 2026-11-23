import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIdentityRefreshTokens1795438796292 implements MigrationInterface {
    name = 'CreateIdentityRefreshTokens1795438796292'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "identity"."refresh_tokens" ("id" uuid NOT NULL, "familyId" uuid NOT NULL, "userId" uuid NOT NULL, "tokenHash" character(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "familyExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_identity_refresh_tokens_tokenHash" UNIQUE ("tokenHash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_identity_refresh_tokens_expiresAt" ON "identity"."refresh_tokens"  ("expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_identity_refresh_tokens_userId" ON "identity"."refresh_tokens"  ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_identity_refresh_tokens_familyId" ON "identity"."refresh_tokens"  ("familyId") `);
        await queryRunner.query(`ALTER TABLE "identity"."refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`DROP INDEX "identity"."IDX_identity_refresh_tokens_familyId"`);
        await queryRunner.query(`DROP INDEX "identity"."IDX_identity_refresh_tokens_userId"`);
        await queryRunner.query(`DROP INDEX "identity"."IDX_identity_refresh_tokens_expiresAt"`);
        await queryRunner.query(`DROP TABLE "identity"."refresh_tokens"`);
    }

}
