import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOutboxTable1795240855117 implements MigrationInterface {
    name = 'CreateOutboxTable1795240855117'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "shared"."outbox" ("id" uuid NOT NULL, "type" character varying NOT NULL, "version" integer NOT NULL, "payload" jsonb NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_340ab539f309f03bdaa14aa7649" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "shared"."outbox"`);
    }

}
