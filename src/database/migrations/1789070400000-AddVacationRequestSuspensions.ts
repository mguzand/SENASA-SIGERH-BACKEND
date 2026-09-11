import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVacationRequestSuspensions1789070400000 implements MigrationInterface {
  name = 'AddVacationRequestSuspensions1789070400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."vacation_requests_status_enum" ADD VALUE IF NOT EXISTS 'PARTIALLY_SUSPENDED'`);
    await queryRunner.query(`ALTER TYPE "public"."vacation_requests_status_enum" ADD VALUE IF NOT EXISTS 'SUSPENDED'`);
    await queryRunner.query(`ALTER TYPE "public"."vacation_requests_hr_status_enum" ADD VALUE IF NOT EXISTS 'PARTIALLY_SUSPENDED'`);
    await queryRunner.query(`ALTER TYPE "public"."vacation_requests_hr_status_enum" ADD VALUE IF NOT EXISTS 'SUSPENDED'`);
    await queryRunner.query(`ALTER TYPE "public"."vacation_requests_boss_status_enum" ADD VALUE IF NOT EXISTS 'PARTIALLY_SUSPENDED'`);
    await queryRunner.query(`ALTER TYPE "public"."vacation_requests_boss_status_enum" ADD VALUE IF NOT EXISTS 'SUSPENDED'`);
    await queryRunner.query(`ALTER TYPE "public"."vacation_movements_type_enum" ADD VALUE IF NOT EXISTS 'SUSPENSION'`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "public"."vacation_request_days_status_enum" AS ENUM ('APPROVED', 'SUSPENDED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "vacation_request_suspensions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "vacation_request_id" uuid NOT NULL,
      "hr_employee_id" uuid NOT NULL,
      "suspension_date" date NOT NULL,
      "reason" text NOT NULL,
      "restored_days" numeric(5,2) NOT NULL DEFAULT 0,
      "suspend_all_remaining" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_vacation_request_suspensions" PRIMARY KEY ("id"),
      CONSTRAINT "FK_vacation_suspension_request" FOREIGN KEY ("vacation_request_id") REFERENCES "vacation_requests"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_vacation_suspension_hr_employee" FOREIGN KEY ("hr_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vacation_suspension_request" ON "vacation_request_suspensions" ("vacation_request_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vacation_suspension_hr" ON "vacation_request_suspensions" ("hr_employee_id")`);

    await queryRunner.query(`ALTER TABLE "vacation_request_days" ADD COLUMN IF NOT EXISTS "status" "public"."vacation_request_days_status_enum" NOT NULL DEFAULT 'APPROVED'`);
    await queryRunner.query(`ALTER TABLE "vacation_request_days" ADD COLUMN IF NOT EXISTS "suspension_id" uuid NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vacation_request_days_suspension" ON "vacation_request_days" ("suspension_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vacation_request_days_suspendible" ON "vacation_request_days" ("vacation_request_id", "date", "status", "counts_as_vacation")`);
    await queryRunner.query(`DO $$ BEGIN
      ALTER TABLE "vacation_request_days" ADD CONSTRAINT "FK_vacation_request_days_suspension" FOREIGN KEY ("suspension_id") REFERENCES "vacation_request_suspensions"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`UPDATE "vacation_request_days" SET "status" = 'APPROVED' WHERE "status" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vacation_request_days" DROP CONSTRAINT IF EXISTS "FK_vacation_request_days_suspension"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vacation_request_days_suspendible"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vacation_request_days_suspension"`);
    await queryRunner.query(`ALTER TABLE "vacation_request_days" DROP COLUMN IF EXISTS "suspension_id"`);
    await queryRunner.query(`ALTER TABLE "vacation_request_days" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vacation_request_suspensions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."vacation_request_days_status_enum"`);
    // PostgreSQL no permite eliminar valores individuales de enum de forma segura.
  }
}
