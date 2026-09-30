import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExitPermitReceptionReviews1791244800000 implements MigrationInterface {
  name = 'AddExitPermitReceptionReviews1791244800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exit_permit_reception_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "exit_permit_id" uuid NOT NULL,
        "reviewed_by_employee_id" uuid NOT NULL,
        "observation" text,
        "reviewed_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_exit_permit_reception_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_exit_permit_reception_reviews_permit" UNIQUE ("exit_permit_id"),
        CONSTRAINT "FK_reception_review_permit" FOREIGN KEY ("exit_permit_id") REFERENCES "employee_exit_permits"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reception_review_employee" FOREIGN KEY ("reviewed_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reception_review_reviewer" ON "exit_permit_reception_reviews" ("reviewed_by_employee_id")`);
    await queryRunner.query(`
      INSERT INTO "components" ("description", "orden", "visible", "system_id")
      SELECT 'Recepción',
             COALESCE((SELECT MAX("orden") FROM "components"), 0) + 1,
             true,
             COALESCE(
               (
                 SELECT "system_id"
                 FROM "components"
                 WHERE "description" = 'Pases de Salida'
                   AND "system_id" IS NOT NULL
                 LIMIT 1
               ),
               (
                 SELECT "system_id"
                 FROM "components"
                 WHERE "system_id" IS NOT NULL
                 ORDER BY "components_id"
                 LIMIT 1
               )
             )
      WHERE NOT EXISTS (SELECT 1 FROM "components" existing WHERE LOWER(existing."description") = LOWER('Recepción'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "components" WHERE LOWER("description") = LOWER('Recepción') AND NOT EXISTS (SELECT 1 FROM "roles_user" WHERE "component_id" = "components"."components_id")`);
    await queryRunner.query(`DROP TABLE IF EXISTS "exit_permit_reception_reviews"`);
  }
}
