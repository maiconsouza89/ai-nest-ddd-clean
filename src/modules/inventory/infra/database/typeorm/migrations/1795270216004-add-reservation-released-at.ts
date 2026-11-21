import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReservationReleasedAt1795270216004 implements MigrationInterface {
    name = 'AddReservationReleasedAt1795270216004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory"."reservations" ADD "releasedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory"."reservations" DROP COLUMN "releasedAt"`);
    }

}
