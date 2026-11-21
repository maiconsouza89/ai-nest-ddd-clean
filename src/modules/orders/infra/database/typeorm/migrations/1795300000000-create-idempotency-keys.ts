import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIdempotencyKeys1795300000000 implements MigrationInterface {
  name = "CreateIdempotencyKeys1795300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "orders"."idempotency_keys" ("actorId" character varying(255) NOT NULL, "key" character varying(255) NOT NULL, "fingerprint" character varying(255) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_orders_idempotency_keys" PRIMARY KEY ("actorId", "key"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "orders"."idempotency_keys"`);
  }
}
