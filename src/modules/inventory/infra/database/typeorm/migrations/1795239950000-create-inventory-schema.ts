import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventorySchema1795239950000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS inventory`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS inventory`);
  }
}
