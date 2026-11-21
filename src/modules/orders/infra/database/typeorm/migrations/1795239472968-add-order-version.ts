import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderVersion1795239472968 implements MigrationInterface {
  name = "AddOrderVersion1795239472968";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders"."orders" ADD "version" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders"."orders" DROP COLUMN "version"`,
    );
  }
}
