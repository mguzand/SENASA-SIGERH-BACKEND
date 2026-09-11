import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConnectGovernmentVacationDays1789113600000 implements MigrationInterface {
  name = 'ConnectGovernmentVacationDays1789113600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "government_vacation_days" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "title" varchar NOT NULL,
      "description" text NULL, "affectsVacationBalance" boolean NOT NULL DEFAULT true,
      "isActive" boolean NOT NULL DEFAULT true, "createdByUserId" uuid NULL,
      "created_at" timestamp NULL, "updated_at" timestamp NULL,
      "alreadyProcessed" boolean NOT NULL DEFAULT false,
      CONSTRAINT "PK_government_vacation_days" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "employee_government_vacation_exclusions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL,
      "government_vacation_day_id" uuid NOT NULL, "reason" text NULL, "createdByUserId" uuid NULL,
      "created_at" timestamp NULL, "updated_at" timestamp NULL,
      CONSTRAINT "PK_employee_government_vacation_exclusions" PRIMARY KEY ("id"),
      CONSTRAINT "FK_government_exclusion_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_government_exclusion_day" FOREIGN KEY ("government_vacation_day_id") REFERENCES "government_vacation_days"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`ALTER TABLE "government_vacation_days" ADD COLUMN IF NOT EXISTS "affectedEmployees" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "government_vacation_days" ADD COLUMN IF NOT EXISTS "excludedEmployees" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "government_vacation_days" ADD COLUMN IF NOT EXISTS "skippedEmployees" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "vacation_movements" ADD COLUMN IF NOT EXISTS "government_vacation_day_id" uuid NULL`);
    await queryRunner.query(`DO $$ BEGIN ALTER TABLE "vacation_movements" ADD CONSTRAINT "FK_vacation_movement_government_day" FOREIGN KEY ("government_vacation_day_id") REFERENCES "government_vacation_days"("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_government_exclusion_employee" ON "employee_government_vacation_exclusions" ("government_vacation_day_id", "employee_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vacation_movement_government_day" ON "vacation_movements" ("government_vacation_day_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vacation_movement_government_employee" ON "vacation_movements" ("government_vacation_day_id", "employee_id") WHERE "government_vacation_day_id" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vacation_movement_government_day"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_vacation_movement_government_employee"`);
    await queryRunner.query(`ALTER TABLE "vacation_movements" DROP CONSTRAINT IF EXISTS "FK_vacation_movement_government_day"`);
    await queryRunner.query(`ALTER TABLE "vacation_movements" DROP COLUMN IF EXISTS "government_vacation_day_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_government_exclusion_employee"`);
    await queryRunner.query(`ALTER TABLE "government_vacation_days" DROP COLUMN IF EXISTS "skippedEmployees"`);
    await queryRunner.query(`ALTER TABLE "government_vacation_days" DROP COLUMN IF EXISTS "excludedEmployees"`);
    await queryRunner.query(`ALTER TABLE "government_vacation_days" DROP COLUMN IF EXISTS "affectedEmployees"`);
  }
}
