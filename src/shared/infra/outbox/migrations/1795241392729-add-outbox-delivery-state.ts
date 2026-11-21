import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxDeliveryState1795241392729 implements MigrationInterface {
    name = 'AddOutboxDeliveryState1795241392729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "seq" BIGSERIAL NOT NULL`);
        // linhas anteriores a esta migration: o agregado é o pedido do payload
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "aggregateId" character varying`);
        await queryRunner.query(`UPDATE "shared"."outbox" SET "aggregateId" = COALESCE(payload->>'orderId', id::text)`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ALTER COLUMN "aggregateId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "publishedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "attempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "deadAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "lastError" text`);
        await queryRunner.query(`CREATE INDEX "IDX_shared_outbox_pending" ON "shared"."outbox"  ("nextAttemptAt") WHERE "publishedAt" IS NULL AND "deadAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "shared"."IDX_shared_outbox_pending"`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "lastError"`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "deadAt"`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "nextAttemptAt"`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "attempts"`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "publishedAt"`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "aggregateId"`);
        await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "seq"`);
    }

}
