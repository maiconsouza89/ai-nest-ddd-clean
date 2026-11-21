import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcessedEventsTable1795242000000 implements MigrationInterface {
  name = 'CreateProcessedEventsTable1795242000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "shared"."processed_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_shared_processed_events" PRIMARY KEY ("eventId", "consumer"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shared"."processed_events"`);
  }
}
