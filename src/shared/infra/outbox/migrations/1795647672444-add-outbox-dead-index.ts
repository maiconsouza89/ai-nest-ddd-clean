import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxDeadIndex1795647672444 implements MigrationInterface {
    name = 'AddOutboxDeadIndex1795647672444'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_shared_outbox_dead" ON "shared"."outbox"  ("deadAt") WHERE "deadAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "shared"."IDX_shared_outbox_dead"`);
    }

}
