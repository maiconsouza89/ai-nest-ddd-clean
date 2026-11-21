import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrdersTables1795235688952 implements MigrationInterface {
    name = 'CreateOrdersTables1795235688952'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "orders"."order_items" ("orderId" uuid NOT NULL, "productId" character varying NOT NULL, "qty" integer NOT NULL, "unitPriceCents" bigint NOT NULL, "currency" character varying(3) NOT NULL, CONSTRAINT "PK_5dc4f4cfd0b2c11447acab8352c" PRIMARY KEY ("orderId", "productId"))`);
        await queryRunner.query(`CREATE TABLE "orders"."orders" ("id" uuid NOT NULL, "customerId" character varying NOT NULL, "status" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "orders"."order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders"."order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`);
        await queryRunner.query(`DROP TABLE "orders"."orders"`);
        await queryRunner.query(`DROP TABLE "orders"."order_items"`);
    }

}
