import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVacationRequestReschedules1790208000000 implements MigrationInterface {
  name = 'AddVacationRequestReschedules1790208000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "vacation_request_reschedules" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "vacation_request_id" uuid NOT NULL,
      "hr_employee_id" uuid NOT NULL,
      "original_days" jsonb NOT NULL,
      "new_days" jsonb NOT NULL,
      "reason" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_vacation_request_reschedules" PRIMARY KEY ("id"),
      CONSTRAINT "FK_vacation_reschedule_request" FOREIGN KEY ("vacation_request_id") REFERENCES "vacation_requests"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_vacation_reschedule_hr_employee" FOREIGN KEY ("hr_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vacation_reschedule_request" ON "vacation_request_reschedules" ("vacation_request_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vacation_reschedule_hr" ON "vacation_request_reschedules" ("hr_employee_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vacation_reschedule_hr"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vacation_reschedule_request"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vacation_request_reschedules"`);
  }
}
