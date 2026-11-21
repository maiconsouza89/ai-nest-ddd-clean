import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInventoryTables1795240302737 implements MigrationInterface {
    name = 'CreateInventoryTables1795240302737'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "inventory"."reservation_items" ("reservationId" uuid NOT NULL, "productId" uuid NOT NULL, "qty" integer NOT NULL, CONSTRAINT "PK_c6093e7930818ff1b2c0c1d141f" PRIMARY KEY ("reservationId", "productId"))`);
        await queryRunner.query(`CREATE TABLE "inventory"."reservations" ("id" uuid NOT NULL, "referenceId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_inventory_reservations_reference" UNIQUE ("referenceId"), CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inventory"."stock_items" ("productId" uuid NOT NULL, "available" integer NOT NULL DEFAULT '0', CONSTRAINT "CK_inventory_stock_items_available" CHECK ("available" >= 0), CONSTRAINT "PK_bbfb82762aee45829f290ef3381" PRIMARY KEY ("productId"))`);
        await queryRunner.query(`ALTER TABLE "inventory"."reservation_items" ADD CONSTRAINT "FK_47258d2fccc530c4da433a09722" FOREIGN KEY ("reservationId") REFERENCES "inventory"."reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory"."reservation_items" DROP CONSTRAINT "FK_47258d2fccc530c4da433a09722"`);
        await queryRunner.query(`DROP TABLE "inventory"."stock_items"`);
        await queryRunner.query(`DROP TABLE "inventory"."reservations"`);
        await queryRunner.query(`DROP TABLE "inventory"."reservation_items"`);
    }

}
