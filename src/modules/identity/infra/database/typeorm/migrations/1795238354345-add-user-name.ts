import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserName1795238354345 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // coluna nova e obrigatória: as linhas existentes recebem a parte local do e-mail antes do NOT NULL
    await queryRunner.query(`ALTER TABLE "identity"."users" ADD "name" character varying(100)`);
    await queryRunner.query(`UPDATE "identity"."users" SET "name" = left(split_part("email", '@', 1), 100)`);
    await queryRunner.query(`ALTER TABLE "identity"."users" ALTER COLUMN "name" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "name"`);
  }
}
