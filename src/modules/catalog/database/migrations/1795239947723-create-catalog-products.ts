import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCatalogProducts1795239947723 implements MigrationInterface {
    name = 'CreateCatalogProducts1795239947723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "catalog"."products" ("id" uuid NOT NULL, "name" character varying(120) NOT NULL, "priceCents" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'BRL', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "catalog"."products"`);
    }

}
