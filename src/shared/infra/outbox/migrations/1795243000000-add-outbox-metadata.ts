import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutboxMetadata1795243000000 implements MigrationInterface {
  name = 'AddOutboxMetadata1795243000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shared"."outbox" ADD "metadata" jsonb NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shared"."outbox" DROP COLUMN "metadata"`);
  }
}
